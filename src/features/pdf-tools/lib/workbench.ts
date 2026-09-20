// 작업대 — 올린 PDF들을 한 문서처럼 다루고, 고른 기능을 한 번에 적용해 결과 파일을 만듭니다.
//
// 적용 순서(사용자가 신경 쓰지 않도록 여기서 고정):
//   쪽 고르기(선택 쪽만·빈 쪽 삭제) → 쪽 조립(+내용 새기기 → 회전) → 나누기 → 용량 줄이기 → TXT 추출
// "강하게"는 쪽을 그림으로 바꾸므로 맨 뒤에 오고, 내용은 그 전에 새겨져야 그림에 함께 담깁니다.

import { PDFDocument, degrees, type PDFPage } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { drawObjects, type EditObj } from "./editOps";
import { closePdf, openPdf, PdfPasswordError } from "./pdfjs";
import { decrypt } from "./qpdf";
import { shrink, type ShrinkLevel } from "./shrink";
import { extractPages, joinPages } from "./text";
import { formatBytes } from "./download";

export interface Source {
  id: string;
  name: string;
  bytes: ArrayBuffer;
  view: PDFDocumentProxy; // 미리보기·글자 추출용(pdf.js)
  edit: PDFDocument; // 저장용(pdf-lib)
  pages: number;
  /** "암호 풀림" / "제한 풀림" 처럼 불러오면서 손댄 것 */
  note?: string;
}

export interface Item {
  key: string;
  srcId: string;
  /** 원본 파일 안에서의 쪽 위치(0부터) */
  index: number;
  /** 작업대에서 사용자가 돌린 각도(0/90/180/270, 시계 방향) */
  rotation: number;
  selected: boolean;
  /** 쪽 위에 얹은 내용(원본 쪽 방향 기준 좌표) */
  overlays: EditObj[];
}

const toArrayBuffer = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export const loadForEdit = (bytes: ArrayBuffer) => PDFDocument.load(bytes.slice(0));

/**
 * PDF 한 개를 작업대에 올릴 수 있게 엽니다.
 * - 열 때 암호가 필요하면 askPassword 로 물어 풀어 둡니다(null 을 돌려주면 그 파일은 건너뜀 → null 반환).
 * - 열리지만 편집이 제한된 파일(pdf-lib 가 못 여는 파일)은 제한을 풀어 씁니다.
 */
export async function openSource(
  id: string,
  name: string,
  input: ArrayBuffer,
  askPassword: (name: string, wrong: boolean) => Promise<string | null>,
): Promise<Source | null> {
  let bytes = input;
  let note: string | undefined;
  let password: string | undefined;
  let view: PDFDocumentProxy;

  for (;;) {
    try {
      view = await openPdf(bytes, password);
      break;
    } catch (err) {
      if (!(err instanceof PdfPasswordError)) throw err;
      const pw = await askPassword(name, err.wrong);
      if (pw === null) return null;
      password = pw;
    }
  }

  const reopenDecrypted = async (result: Awaited<ReturnType<typeof decrypt>>, why: string) => {
    if (!result.output || (result.code !== 0 && result.code !== 3)) {
      closePdf(view);
      throw new Error(why);
    }
    closePdf(view);
    bytes = toArrayBuffer(result.output);
    view = await openPdf(bytes);
  };

  if (password !== undefined) {
    await reopenDecrypted(await decrypt(input, password), "암호를 풀지 못했습니다.");
    note = "암호 풀림";
  }

  let edit: PDFDocument;
  try {
    edit = await loadForEdit(bytes);
  } catch {
    // pdf.js 는 열리는데 pdf-lib 만 못 여는 파일은 대개 편집이 제한된 PDF입니다.
    await reopenDecrypted(await decrypt(bytes), "편집할 수 없는 PDF입니다. 손상되었을 수 있습니다.");
    edit = await loadForEdit(bytes);
    note = "제한 풀림";
  }
  return { id, name, bytes, view, edit, pages: view.numPages, note };
}

export interface BuildItem {
  srcId: string;
  index: number;
  rotation: number;
  overlays: EditObj[];
}

/** 쪽을 순서대로 모아 한 PDF 로 조립합니다. 내용을 먼저 새기고 사용자 회전은 그 다음에 더합니다. */
export async function buildDocument(items: BuildItem[], docs: Map<string, PDFDocument>): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const wanted = new Map<string, number[]>();
  for (const it of items) wanted.set(it.srcId, [...(wanted.get(it.srcId) ?? []), it.index]);

  // 파일별로 한 번에 복사해서 공유 리소스를 중복 없이 옮깁니다.
  const copied = new Map<string, PDFPage>();
  for (const [srcId, indices] of wanted) {
    const src = docs.get(srcId);
    if (!src) throw new Error("원본 파일을 찾을 수 없습니다.");
    const pages = await out.copyPages(src, indices);
    indices.forEach((idx, i) => copied.set(`${srcId}:${idx}`, pages[i]));
  }

  for (const it of items) {
    const page = copied.get(`${it.srcId}:${it.index}`)!;
    out.addPage(page);
    await drawObjects(out, page, it.overlays);
    if (it.rotation) page.setRotation(degrees((page.getRotation().angle + it.rotation) % 360));
  }
  return out.save({ useObjectStreams: true });
}

export interface ExportOptions {
  /** N쪽씩 나눕니다. 없으면 한 파일 */
  split: number | null;
  shrink: ShrinkLevel | null;
  text: { divider: boolean } | null;
}
export interface OutputFile {
  name: string;
  data: Uint8Array;
}

/** 고른 기능을 순서대로 적용해 결과 파일 목록을 만듭니다. */
export async function runExport(
  items: BuildItem[],
  docs: Map<string, PDFDocument>,
  base: string,
  opts: ExportOptions,
  onStatus: (message: string) => void,
): Promise<{ files: OutputFile[]; notes: string[] }> {
  const notes: string[] = [];
  const size = opts.split && opts.split > 0 ? opts.split : items.length;
  const parts: BuildItem[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));

  const pad = String(parts.length).length;
  const files: OutputFile[] = [];
  const built: Uint8Array[] = [];
  let before = 0;
  let after = 0;

  for (let p = 0; p < parts.length; p++) {
    onStatus(parts.length > 1 ? `쪽을 조립하는 중… (${p + 1}/${parts.length})` : "쪽을 조립하는 중…");
    let bytes = await buildDocument(parts[p], docs);
    built.push(bytes);
    if (opts.shrink) {
      onStatus(parts.length > 1 ? `용량을 줄이는 중… (${p + 1}/${parts.length})` : "용량을 줄이는 중…");
      const result = await shrink(opts.shrink, toArrayBuffer(bytes));
      before += bytes.length;
      // 줄지 않았으면 조립한 그대로 씁니다(오히려 커진 파일을 내보내지 않기 위해).
      if (result.bytes.length < bytes.length) bytes = result.bytes;
      after += bytes.length;
      if (p === 0) notes.push(result.note);
    }
    files.push({
      name: parts.length === 1 ? `${base}_다듬음.pdf` : `${base}_${String(p + 1).padStart(pad, "0")}.pdf`,
      data: bytes,
    });
  }
  if (opts.shrink) {
    notes.unshift(
      after < before ? `용량 ${formatBytes(before)} → ${formatBytes(after)}` : "용량은 더 줄어들지 않았어요(조립한 그대로 저장).",
    );
  }

  if (opts.text) {
    onStatus("글자를 꺼내는 중…");
    const full = built.length === 1 ? built[0] : await buildDocument(items, docs);
    const doc = await openPdf(toArrayBuffer(full));
    try {
      const pages = await extractPages(doc);
      const chars = pages.join("").replace(/\s/g, "").length;
      if (chars === 0) notes.push("이 PDF에서는 글자를 찾지 못해 TXT는 만들지 않았어요(스캔본은 글자 인식이 필요합니다).");
      else files.push({ name: `${base}.txt`, data: new TextEncoder().encode(joinPages(pages, opts.text.divider)) });
    } finally {
      closePdf(doc);
    }
  }
  return { files, notes };
}
