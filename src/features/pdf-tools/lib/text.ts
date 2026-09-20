// 텍스트 추출 — pdf.js 로 쪽마다 글자를 꺼냅니다.

import type { PDFDocumentProxy } from "pdfjs-dist";

/** 쪽마다의 글자. hasEOL 이 참인 조각 뒤에서 줄이 바뀝니다. */
export async function extractPages(doc: PDFDocumentProxy): Promise<string[]> {
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join("").trim());
    page.cleanup();
  }
  return out;
}

/** TXT 저장용으로 합칩니다. 앞의 BOM 은 윈도 메모장·엑셀이 UTF-8 한글을 깨지 않게 하는 표시입니다. */
export function joinPages(pages: string[], divider: boolean): string {
  return "﻿" + pages.map((t, i) => (divider ? `----- ${i + 1}쪽 -----\n${t}` : t)).join("\n\n");
}
