// 문서 변환 — PDF·이미지는 바로 한 PDF로 합치고, DOCX·TXT는 브라우저 인쇄 창("PDF로 저장")으로 넘깁니다.
// DOCX·TXT 를 직접 PDF 로 그리려면 한글 글꼴을 파일에 넣어야 해서(수 MB) 인쇄 창 방식을 택했습니다.

import { PDFDocument } from "pdf-lib";

export type ConvertKind = "pdf" | "image" | "docx" | "txt";

export function kindOf(file: File): ConvertKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif|bmp)$/.test(name) || file.type.startsWith("image/")) return "image";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt")) return "txt";
  return null;
}

export type PageFit = "a4" | "image";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 24;
const MAX_SIDE = 3508; // 300dpi A4 의 긴 변 — 이보다 크면 줄입니다.

/**
 * 사진을 PDF 에 넣을 수 있는 그림으로 바꿉니다.
 * 휴대폰 사진은 EXIF 회전 정보가 있어 그대로 넣으면 옆으로 누워 보이므로, 브라우저가 회전을 적용해 디코드한 뒤
 * 다시 인코딩합니다(JPEG 는 화질 0.92, 투명이 있을 수 있는 PNG 등은 PNG).
 */
async function toEmbeddable(file: File): Promise<{ bytes: Uint8Array; png: boolean; w: number; h: number }> {
  const bitmap = await createImageBitmap(file); // 기본값이 EXIF 회전 적용
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const png = /png|gif|webp/.test(file.type) || /\.(png|gif|webp)$/i.test(file.name);
  if (!png) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("그림을 읽지 못했습니다."))), png ? "image/png" : "image/jpeg", 0.92),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), png, w, h };
}

export type MergeInput = { file: File; kind: "pdf" | "image" };

/** PDF·이미지를 목록 순서대로 이어 붙여 한 PDF 로 만듭니다. 각 파일이 끝나면 onProgress 를 부릅니다. */
export async function mergeToPdf(inputs: MergeInput[], fit: PageFit, onProgress?: (done: number) => void): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (let i = 0; i < inputs.length; i++) {
    const { file, kind } = inputs[i];
    if (kind === "pdf") {
      const src = await PDFDocument.load(await file.arrayBuffer()).catch(() => {
        throw new Error(`「${file.name}」은 암호나 편집 제한이 걸려 있거나 손상되었습니다. 「PDF 암호 제거」에서 사본을 만든 뒤 다시 올려 주세요.`);
      });
      (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
    } else {
      const img = await toEmbeddable(file).catch(() => {
        throw new Error(`「${file.name}」 그림을 읽을 수 없습니다.`);
      });
      const embedded = img.png ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
      if (fit === "image") {
        // 화면 96dpi 기준(1px = 0.75pt)으로 그림 크기 그대로
        const w = img.w * 0.75;
        const h = img.h * 0.75;
        out.addPage([w, h]).drawImage(embedded, { x: 0, y: 0, width: w, height: h });
      } else {
        const landscape = img.w > img.h;
        const pw = landscape ? A4.h : A4.w;
        const ph = landscape ? A4.w : A4.h;
        const k = Math.min((pw - MARGIN * 2) / img.w, (ph - MARGIN * 2) / img.h);
        const w = img.w * k;
        const h = img.h * k;
        out.addPage([pw, ph]).drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }
    }
    onProgress?.(i + 1);
  }
  return out.save({ useObjectStreams: true });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 인쇄 창에서 볼 문서 본문(HTML). DOCX 는 mammoth 로, TXT 는 줄바꿈을 살려 감쌉니다. */
export async function documentToHtml(file: File, kind: "docx" | "txt"): Promise<string> {
  if (kind === "txt") {
    // 윈도 메모장의 옛 한글 인코딩(CP949)으로 저장된 TXT 도 읽도록 UTF-8 이 아니면 EUC-KR 로 다시 읽습니다.
    const buf = await file.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder("euc-kr").decode(buf);
    }
    return `<pre>${escapeHtml(text.replace(/^﻿/, ""))}</pre>`;
  }
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

/** 숨은 프레임에 본문을 넣고 브라우저 인쇄 창을 엽니다(대상을 "PDF로 저장"으로 고르면 됩니다). */
export function printHtml(title: string, body: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: A4; margin: 20mm; }
    body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; font-size: 11pt; line-height: 1.6; color: #000; }
    pre { font-family: inherit; white-space: pre-wrap; word-break: break-word; margin: 0; }
    img { max-width: 100%; }
    table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 4px 8px; }
  </style></head><body>${body}</body></html>`);
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.contentWindow!.addEventListener("afterprint", cleanup);
  // 그림이 있는 문서는 그림이 다 그려진 뒤에 인쇄해야 빈칸으로 나오지 않습니다.
  setTimeout(() => frame.contentWindow!.print(), 300);
}
