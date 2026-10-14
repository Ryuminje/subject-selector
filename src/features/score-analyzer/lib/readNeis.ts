// 브라우저에서 교과학습발달상황 PDF 를 읽어 학생별 과목 기록으로 바꿉니다. 파일은 서버로 올라가지 않습니다.

import { openPdf, closePdf, loadPdfjs } from "@/features/pdf-tools/lib/pdfjs";
import { linesFromOperatorList, mergeNeisPages, parseNeisPage, type NeisPage, type NeisStudent } from "./neis";

export interface NeisReadResult {
  students: NeisStudent[];
  pages: number;
  /** 성적표로 읽은 쪽 수 */
  parsedPages: number;
}

export async function readNeisPdf(file: File): Promise<NeisReadResult> {
  const lib = await loadPdfjs();
  const doc = await openPdf(await file.arrayBuffer());
  try {
    const parsed: NeisPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.flatMap((it) =>
        "str" in it ? [{ str: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }] : [],
      );
      const ops = await page.getOperatorList();
      const r = parseNeisPage(items, linesFromOperatorList(ops, lib.OPS));
      if (r) parsed.push(r);
      page.cleanup();
    }
    return { students: mergeNeisPages(parsed), pages: doc.numPages, parsedPages: parsed.length };
  } finally {
    closePdf(doc);
  }
}
