// 명단 프리셋을 엑셀로 만들 때 내려받을 수 있는 예시 서식입니다.
// parseRosterExcel.ts는 서식이 제각각인 파일도 읽어내지만, 처음 쓰는 분에게는 "이대로 채우면
// 됩니다" 하는 견본이 있는 편이 훨씬 쉽습니다. A열=성명 한 줄에 한 명, 그 아래 예시 세 명은
// 지우고 실제 명단으로 바꿔 쓰는 용도입니다.
import * as XLSX from "xlsx-js-style";

const EXAMPLE_NAMES = ["홍길동", "김민준", "이서연"];

const thinBorder = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};

function buildTemplateSheet() {
  const rows = [["성명", "← 이 열에 이름을 한 줄에 한 명씩 적어 주세요"], ...EXAMPLE_NAMES.map((n) => [n, ""])];
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 머리글: RosterTable 화면과 같은 남색 바탕 흰 글씨(#1a237e)
  ws["A1"].s = {
    font: { name: "맑은 고딕", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1A237E" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: thinBorder,
  };
  ws["B1"].s = {
    font: { name: "맑은 고딕", sz: 10, italic: true, color: { rgb: "64748B" } },
    alignment: { vertical: "center" },
  };

  // 예시 이름 세 줄: 회색 기울임으로 "지우고 쓰세요"라는 신호를 줍니다.
  for (let r = 1; r <= EXAMPLE_NAMES.length; r += 1) {
    const ref = XLSX.utils.encode_cell({ r, c: 0 });
    ws[ref].s = {
      font: { name: "맑은 고딕", sz: 11, italic: true, color: { rgb: "94A3B8" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder,
    };
  }

  ws["!cols"] = [{ wch: 14 }, { wch: 36 }];
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

/** 브라우저에서 "명단_예시서식.xlsx"를 내려받습니다. */
export function downloadRosterTemplate(): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildTemplateSheet(), "명단");
  XLSX.writeFile(wb, "명단_예시서식.xlsx");
}
