// 업로드된 파일에서 검색 가능한 "글자"를 뽑아냅니다.
//
// 페이지 번호를 살려두는 게 중요합니다 — 답변에 "기재요령 p.142" 같은 근거를 붙이려면
// 조각마다 원래 몇 쪽이었는지를 알아야 하기 때문입니다. PDF만 진짜 페이지가 있고,
// 나머지 형식은 page = null로 두고 파일 이름만 근거로 씁니다.

import * as XLSX from "xlsx";

export interface ExtractedPage {
  /** 1부터 시작하는 페이지 번호. 페이지 개념이 없는 형식은 null */
  page: number | null;
  text: string;
}

export interface ExtractResult {
  pages: ExtractedPage[];
  pageCount: number | null;
}

export class ExtractError extends Error {}

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isSupportedFile(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return (
    ext === ".pdf" ||
    ext === ".docx" ||
    ext === ".xlsx" ||
    ext === ".xls" ||
    TEXT_EXTENSIONS.includes(ext)
  );
}

async function extractPdf(bytes: Buffer): Promise<ExtractResult> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  // mergePages: false → 페이지별 문자열 배열이 그대로 나옵니다.
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t ?? "" }));
  return { pages, pageCount: totalPages };
}

async function extractDocx(bytes: Buffer): Promise<ExtractResult> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return { pages: [{ page: null, text: value ?? "" }], pageCount: null };
}

function extractSpreadsheet(bytes: Buffer): ExtractResult {
  const wb = XLSX.read(bytes, { type: "buffer" });
  // 시트 하나를 "페이지" 하나처럼 다루되, 진짜 쪽수는 아니므로 page는 null로 둡니다.
  const pages = wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    return { page: null as number | null, text: `[시트: ${name}]\n${csv}` };
  });
  return { pages, pageCount: null };
}

function extractPlainText(bytes: Buffer): ExtractResult {
  return { pages: [{ page: null, text: bytes.toString("utf8") }], pageCount: null };
}

/**
 * 파일 바이트에서 텍스트를 뽑습니다. 형식을 못 다루거나 글자가 사실상 없으면
 * ExtractError를 던지고, 그 메시지가 그대로 화면의 "실패" 사유로 표시됩니다.
 */
export async function extractDocumentText(fileName: string, bytes: Buffer): Promise<ExtractResult> {
  const ext = extensionOf(fileName);

  let result: ExtractResult;
  if (ext === ".pdf") {
    result = await extractPdf(bytes);
  } else if (ext === ".docx") {
    result = await extractDocx(bytes);
  } else if (ext === ".xlsx" || ext === ".xls") {
    result = extractSpreadsheet(bytes);
  } else if (TEXT_EXTENSIONS.includes(ext)) {
    result = extractPlainText(bytes);
  } else if (ext === ".hwp" || ext === ".hwpx") {
    throw new ExtractError("한글(hwp) 파일은 아직 읽을 수 없습니다. PDF로 저장한 뒤 올려주세요.");
  } else if (ext === ".doc") {
    throw new ExtractError("옛 워드(doc) 형식은 읽을 수 없습니다. docx나 PDF로 저장한 뒤 올려주세요.");
  } else {
    throw new ExtractError(`${ext || "이 형식"}은 지원하지 않습니다. PDF · DOCX · 엑셀 · 텍스트 파일만 올릴 수 있습니다.`);
  }

  const total = result.pages.reduce((sum, p) => sum + p.text.trim().length, 0);
  if (total < 50) {
    throw new ExtractError(
      "파일에서 읽어낼 글자가 거의 없습니다. 스캔한 이미지 PDF라면 글자 인식(OCR)이 된 PDF로 다시 저장해 주세요."
    );
  }

  return result;
}
