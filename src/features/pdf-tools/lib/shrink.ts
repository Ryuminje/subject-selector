// PDF 용량 줄이기 — 세 단계. 모두 브라우저 안에서만 돌아가고, 원본 바이트는 바꾸지 않습니다.
//
//  light    구조만 무손실 압축(qpdf). 글자·검색 그대로. 용량이 크게 줄지는 않을 수 있음.
//  balanced 안에 든 JPEG 사진만 해상도·화질을 낮춰 다시 넣음(pdf-lib). 글자·검색 그대로.
//  strong   쪽마다 그림으로 다시 그려 새 PDF로 만듦. 가장 작지만 글자가 그림이 되어 검색·복사가 안 됨.

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { closePdf, openPdf, renderPage } from "./pdfjs";
import { optimize } from "./qpdf";

export type ShrinkLevel = "light" | "balanced" | "strong";
export type Progress = (done: number, total: number) => void;

export interface ShrinkResult {
  bytes: Uint8Array;
  /** 결과에 대한 한 줄 설명 */
  note: string;
}

const BALANCED = { maxSide: 1754, quality: 0.72 }; // A4 를 150dpi 로 볼 때의 긴 변
const STRONG = { dpi: 100, quality: 0.55 };
const MIN_GAIN = 0.85; // 다시 압축한 그림이 원래의 85% 이하일 때만 바꿔 끼움

const toArrayBuffer = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error("그림을 만들지 못했습니다."))),
      "image/jpeg",
      quality,
    ),
  );

export async function shrinkLight(bytes: ArrayBuffer): Promise<ShrinkResult> {
  return { bytes: await optimize(bytes), note: "구조만 압축했어요. 글자와 검색은 그대로입니다." };
}

const NAME = PDFName.of;

/** 색 공간이 단순 RGB·회색인 JPEG 만 다시 압축합니다(CMYK·색인·마스크 그림은 건드리지 않음). */
function isPlainJpeg(doc: PDFDocument, dict: PDFDict): boolean {
  if (dict.get(NAME("Subtype")) !== NAME("Image")) return false;
  const filter = dict.get(NAME("Filter"));
  const only = filter instanceof PDFArray ? (filter.size() === 1 ? filter.get(0) : null) : filter;
  if (only !== NAME("DCTDecode")) return false;
  if (dict.has(NAME("Mask")) || dict.has(NAME("Decode")) || dict.get(NAME("ImageMask"))?.toString() === "true") return false;
  if (dict.get(NAME("BitsPerComponent"))?.toString() !== "8") return false;
  let cs = dict.get(NAME("ColorSpace"));
  if (cs instanceof PDFArray) {
    if (cs.get(0) !== NAME("ICCBased")) return false;
    const profile = doc.context.lookup(cs.get(1));
    const n = profile && "dict" in profile ? (profile as { dict: PDFDict }).dict.get(NAME("N")) : null;
    return n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1);
  }
  cs = cs && doc.context.lookup(cs);
  return cs === NAME("DeviceRGB") || cs === NAME("DeviceGray");
}

export async function shrinkBalanced(bytes: ArrayBuffer, onProgress?: Progress): Promise<ShrinkResult> {
  const doc = await PDFDocument.load(bytes.slice(0));
  const targets = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && isPlainJpeg(doc, obj.dict)) as [import("pdf-lib").PDFRef, PDFRawStream][];

  let replaced = 0;
  for (let i = 0; i < targets.length; i++) {
    const [ref, stream] = targets[i];
    onProgress?.(i, targets.length);
    try {
      const original = stream.contents;
      // 사진의 EXIF 회전 정보는 PDF 에서 무시되므로 브라우저도 회전하지 않게 합니다.
      const bitmap = await createImageBitmap(new Blob([original as BlobPart], { type: "image/jpeg" }), {
        imageOrientation: "none",
      } as ImageBitmapOptions);
      const scale = Math.min(1, BALANCED.maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const jpeg = await canvasToJpeg(canvas, BALANCED.quality);
      if (jpeg.length > original.length * MIN_GAIN) continue;

      const dict = doc.context.obj({
        Type: "XObject",
        Subtype: "Image",
        Width: w,
        Height: h,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
        Filter: "DCTDecode",
      });
      // 투명도(SMask)는 크기가 달라도 되므로 그대로 이어 붙입니다.
      const smask = stream.dict.get(NAME("SMask"));
      if (smask) dict.set(NAME("SMask"), smask);
      doc.context.assign(ref, PDFRawStream.of(dict, jpeg));
      replaced++;
    } catch {
      // 디코드할 수 없는 그림은 그대로 둡니다.
    }
  }
  onProgress?.(targets.length, targets.length);

  const saved = await doc.save({ useObjectStreams: true });
  let out: Uint8Array = saved;
  try {
    out = await optimize(toArrayBuffer(saved));
  } catch {
    // 구조 압축이 안 되어도 그림을 줄인 결과는 그대로 씁니다.
  }
  return {
    bytes: out,
    note:
      replaced > 0
        ? `사진 ${replaced}장을 다시 압축했어요. 글자와 검색은 그대로입니다.`
        : "다시 압축할 수 있는 사진이 없었어요. 스캔본이라면 「강하게」가 더 잘 줄어듭니다.",
  };
}

export async function shrinkStrong(bytes: ArrayBuffer, onProgress?: Progress): Promise<ShrinkResult> {
  const src = await openPdf(bytes);
  try {
    const out = await PDFDocument.create();
    const canvas = document.createElement("canvas");
    for (let n = 1; n <= src.numPages; n++) {
      onProgress?.(n - 1, src.numPages);
      const page = await src.getPage(n);
      const base = page.getViewport({ scale: 1 });
      await renderPage(page, canvas, Math.round((base.width * STRONG.dpi) / 72));
      const image = await out.embedJpg(await canvasToJpeg(canvas, STRONG.quality));
      out.addPage([base.width, base.height]).drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
    }
    onProgress?.(src.numPages, src.numPages);
    return {
      bytes: await out.save({ useObjectStreams: true }),
      note: "쪽을 그림으로 바꿔 줄였어요. 글자 검색·복사는 되지 않습니다.",
    };
  } finally {
    closePdf(src);
  }
}

export function shrink(level: ShrinkLevel, bytes: ArrayBuffer, onProgress?: Progress): Promise<ShrinkResult> {
  if (level === "light") return shrinkLight(bytes);
  return level === "balanced" ? shrinkBalanced(bytes, onProgress) : shrinkStrong(bytes, onProgress);
}
