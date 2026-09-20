// pdf.js 로더 — 브라우저 전용. 워커·글꼴·CMap은 모두 같은 서버의 /pdfjs 에서 읽습니다(CDN 사용 안 함).
// 처음 부를 때만 라이브러리를 내려받도록 동적 import 로 감쌌습니다.

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

let libPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs() {
  libPromise ??= import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return lib;
  });
  return libPromise;
}

/** 암호가 필요하거나 틀렸을 때 던지는 오류. */
export class PdfPasswordError extends Error {
  constructor(public readonly wrong: boolean) {
    super(wrong ? "암호가 맞지 않습니다." : "암호로 보호된 PDF입니다.");
  }
}

/** getDocument 는 넘겨준 버퍼를 워커로 넘기며 비워 버리므로 복사본을 씁니다. */
export async function openPdf(bytes: ArrayBuffer, password?: string): Promise<PDFDocumentProxy> {
  const lib = await loadPdfjs();
  try {
    return await lib.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      password,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
      iccUrl: "/pdfjs/iccs/",
    }).promise;
  } catch (err) {
    const e = err as { name?: string; code?: number };
    // pdf.js PasswordResponses: NEED_PASSWORD = 1, INCORRECT_PASSWORD = 2
    if (e?.name === "PasswordException") throw new PdfPasswordError(e.code === 2);
    throw err;
  }
}

/**
 * 한 쪽을 주어진 캔버스에 폭(px)에 맞춰 그립니다. 그린 뒤의 쪽 크기 비율을 돌려줍니다.
 * extraRotation 은 쪽 자체의 회전에 더해 시계 방향으로 더 돌려 그릴 각도입니다(작업대에서 사용자가 돌린 만큼).
 */
export async function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, width: number, extraRotation = 0) {
  const rotation = (page.rotate + extraRotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const viewport = page.getViewport({ scale: width / base.width, rotation });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport, background: "rgb(255,255,255)" }).promise;
  return viewport.height / viewport.width;
}

/** 문서를 닫아 워커의 메모리를 돌려줍니다. v6 에서는 로딩 작업이 문서 수명을 쥐고 있습니다. */
export function closePdf(doc: PDFDocumentProxy) {
  void doc.loadingTask.destroy().catch(() => {});
}
