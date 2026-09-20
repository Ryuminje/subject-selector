// 내용 넣기 — 쪽 위에 얹은 텍스트·도형·그림을 pdf-lib 로 PDF 쪽에 새겨 넣습니다. 원본은 건드리지 않습니다.
//
// 좌표는 "원본 쪽 방향"(쪽 자체의 회전은 적용, 사용자가 작업대에서 돌린 회전은 미적용)의 화면 기준 —
// 왼쪽 위 원점, 단위 pt — 으로 저장합니다. 사용자가 쪽을 돌리는 건 저장 마지막에 쪽 회전값에 더하기만 하므로
// 얹은 내용이 쪽과 함께 돌아가고, 돌린 뒤에 내용을 넣어도 위치가 어긋나지 않습니다.
// 텍스트는 글꼴 파일 없이 한글이 나오도록 브라우저가 그린 그림(PNG)으로 넣습니다 — 그래서 넣은 글자는 선택·검색이 안 됩니다.

import { PDFDocument, degrees, rgb, type PDFPage } from "pdf-lib";

export interface TextMeta {
  value: string;
  size: number; // pt
  color: string; // #rrggbb
}

interface Box {
  id: number;
  /** 원본 쪽 방향 화면에서의 바깥 상자(회전된 그림이면 회전 뒤의 바깥 상자) */
  x: number;
  y: number;
  w: number;
  h: number;
}
export type EditObj =
  | (Box & { kind: "rect"; style: "highlight" | "box"; color: string })
  | (Box & {
      kind: "image";
      src: string;
      text?: TextMeta;
      /** 그림 내용이 시계 방향으로 돌아 있는 각도(0/90/180/270). 없으면 0 */
      rot?: number;
    });

const S = 3; // 글자 그림을 3배 크기로 그려 확대해도 선명하게
const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/** 글자를 투명 배경 PNG 로 그립니다. w·h 는 쪽 위에서 차지하는 크기(pt)입니다. */
export function renderText(meta: TextMeta): { src: string; w: number; h: number } {
  const lines = (meta.value || " ").split("\n");
  const px = meta.size * S;
  const lineH = px * 1.35;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${px}px ${FONT}`;
  const width = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width))) + 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, Math.ceil(lineH * lines.length));
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${px}px ${FONT}`;
  ctx.fillStyle = meta.color;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, 2, i * lineH + (lineH - px) / 2));
  return { src: canvas.toDataURL("image/png"), w: canvas.width / S, h: canvas.height / S };
}

/**
 * 크기 W×H 인 화면을 시계 방향으로 deg 도 돌렸을 때, 상자가 놓이는 자리.
 * 돌린 화면의 크기는 90/270도면 H×W 가 됩니다. 되돌릴 때는 (360 - deg) 와 돌린 화면의 크기를 넣으면 됩니다.
 */
export function rotBox(b: { x: number; y: number; w: number; h: number }, deg: number, W: number, H: number) {
  switch (((deg % 360) + 360) % 360) {
    case 90:
      return { x: H - (b.y + b.h), y: b.x, w: b.h, h: b.w };
    case 180:
      return { x: W - (b.x + b.w), y: H - (b.y + b.h), w: b.w, h: b.h };
    case 270:
      return { x: b.y, y: W - (b.x + b.w), w: b.h, h: b.w };
    default:
      return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
}

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const dataUrlToBytes = (url: string) => Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));

/**
 * 보이는 쪽 좌표 (dx, dy: 왼쪽 위 원점) → PDF 사용자 공간 좌표(왼쪽 아래 원점).
 * 쪽이 시계 방향으로 rot 도 돌아 보이도록 저장된 경우를 함께 처리합니다.
 */
export function toUserSpace(
  rot: number,
  crop: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
) {
  const { width: W, height: H } = crop;
  let ux: number;
  let uy: number;
  switch (rot) {
    case 90:
      ux = dy;
      uy = dx;
      break;
    case 180:
      ux = W - dx;
      uy = dy;
      break;
    case 270:
      ux = W - dy;
      uy = H - dx;
      break;
    default:
      ux = dx;
      uy = H - dy;
  }
  return { x: crop.x + ux, y: crop.y + uy };
}

/**
 * 쪽에 개체를 새깁니다. 쪽의 현재 회전값(원본 그대로)을 기준으로 하므로,
 * 사용자가 돌린 회전은 이 함수를 부른 다음에 더해야 합니다.
 */
export async function drawObjects(doc: PDFDocument, page: PDFPage, list: EditObj[]) {
  if (list.length === 0) return;
  const rot = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const crop = page.getCropBox();
  for (const o of list) {
    // 그림 내용이 돌아 있으면 바깥 상자의 가로세로가 내용의 세로가로입니다.
    const objRot = o.kind === "image" ? (((o.rot ?? 0) % 360) + 360) % 360 : 0;
    const swap = objRot % 180 !== 0;
    const nw = swap ? o.h : o.w;
    const nh = swap ? o.w : o.h;
    // 화면에서 내용이 시계 방향 objRot 도 돌아 보이려면, 화면이 사용자 공간을 시계 방향 rot 도 돌린 것이므로
    // 사용자 공간에서는 반시계 방향 (rot - objRot) 도로 그려야 합니다.
    const deg = (((rot - objRot) % 360) + 360) % 360;
    const rad = (deg * Math.PI) / 180;
    // pdf-lib 는 왼쪽 아래 모서리를 기준으로 돌리므로, 바깥 상자의 중심이 제자리에 오도록 기준점을 역산합니다.
    const c = toUserSpace(rot, crop, o.x + o.w / 2, o.y + o.h / 2);
    const x = c.x - ((nw / 2) * Math.cos(rad) - (nh / 2) * Math.sin(rad));
    const y = c.y - ((nw / 2) * Math.sin(rad) + (nh / 2) * Math.cos(rad));
    const rotate = degrees(deg);
    if (o.kind === "rect") {
      if (o.style === "highlight") {
        page.drawRectangle({ x, y, width: nw, height: nh, rotate, color: toRgb(o.color), opacity: 0.35 });
      } else {
        page.drawRectangle({ x, y, width: nw, height: nh, rotate, borderColor: toRgb(o.color), borderWidth: 1.5 });
      }
    } else {
      const image = await doc.embedPng(dataUrlToBytes(o.src));
      page.drawImage(image, { x, y, width: nw, height: nh, rotate });
    }
  }
}
