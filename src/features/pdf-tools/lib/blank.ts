// 빈 쪽 찾기 — 쪽을 작게 그려 글자·그림이 차지하는 비율(잉크 비율)을 잽니다. 브라우저 안에서만 계산합니다.

import type { PDFPageProxy } from "pdfjs-dist";
import { renderPage } from "./pdfjs";

const SCAN_WIDTH = 100; // 분석용 축소 폭(px) — 비율만 보면 되므로 작게
const EDGE = 0.05; // 가장자리 5%는 스캐너 그림자·테두리라 무시
const INK_BELOW = 200; // 밝기가 이보다 어두우면 글자·그림으로 셈(0~255)

/** 한 쪽에서 글자·그림이 차지하는 비율(0~1). */
export async function inkRatio(page: PDFPageProxy): Promise<number> {
  const canvas = document.createElement("canvas");
  await renderPage(page, canvas, SCAN_WIDTH);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width, height } = canvas;
  const x0 = Math.floor(width * EDGE);
  const x1 = Math.ceil(width * (1 - EDGE));
  const y0 = Math.floor(height * EDGE);
  const y1 = Math.ceil(height * (1 - EDGE));
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    // 사람 눈에 맞춘 밝기 가중치(녹색이 가장 밝게 보임)
    if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < INK_BELOW) ink++;
  }
  page.cleanup();
  return ink / (data.length / 4);
}
