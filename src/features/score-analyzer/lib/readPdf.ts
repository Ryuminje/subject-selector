// 브라우저에서 성적통지표 PDF 를 읽어 Report 목록으로 바꿉니다. 파일은 서버로 올라가지 않습니다.

import { openPdf, closePdf } from "@/features/pdf-tools/lib/pdfjs";
import { parseReportPage } from "./parseReport";
import { parseKiceReportPage } from "./parseKiceReport";
import type { Report } from "./types";

export interface ReadResult {
  reports: Report[];
  /** 통지표로 읽지 못한 쪽 수 */
  skipped: number;
  pages: number;
}

export async function readReportPdf(file: File): Promise<ReadResult> {
  const doc = await openPdf(await file.arrayBuffer());
  try {
    const reports: Report[] = [];
    let skipped = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.flatMap((it) =>
        "str" in it ? [{ str: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }] : [],
      );
      // 교육청 연합학력평가 양식을 먼저, 아니면 평가원 모의평가 양식을 시도합니다.
      const r = parseReportPage(items) ?? parseKiceReportPage(items);
      if (r) reports.push(r);
      else skipped += 1;
      page.cleanup();
    }
    return { reports, skipped, pages: doc.numPages };
  } finally {
    closePdf(doc);
  }
}
