// 엑셀(.xlsx/.xls/.csv) 파일에서 "이름 열"을 찾아 명단 프리셋 후보를 만들어 주는 파서입니다.
//
// 학교에서 돌아다니는 명렬표는 서식이 제각각입니다. 이름이 A열일 때도 있고, 번호가 A열이고
// 이름이 B열일 때도 있으며, 머리글이 있을 때도 없을 때도 있습니다. 그래서 자동으로 하나를
// 고르되 **사용자가 언제든 다른 열/시트로 바꿀 수 있게** 후보를 전부 돌려줍니다.
// (자동 판별만 하고 끝내면 서식이 어긋난 파일에서 조용히 엉뚱한 열을 집어옵니다.)
// ⚠️ 브라우저에서 도는 코드라 "xlsx-js-style"을 씁니다. 순정 "xlsx"는 이 저장소에서 서버 라우트
// (api/schedule-helper/upload)에서만 쓰인 적이 있고, 브라우저 번들에 넣어 본 적이 없습니다.
// 수요조사·변경조사의 클라이언트 업로드가 모두 xlsx-js-style로 동작 중이니 같은 것을 씁니다.
import * as XLSX from "xlsx-js-style";
import { sanitizeRosterNames } from "./sanitizeRosterNames";

// 명렬표 한 장이 이보다 크면 이름 열이 아니라 다른 자료입니다. 브라우저가 멎지 않게 잘라 읽습니다.
const MAX_ROWS = 2000;
const MAX_COLS = 40;

export interface RosterColumn {
  index: number; // 0부터
  letter: string; // "A", "B" …
  cells: string[]; // 첫 행부터 그대로. 머리글 처리는 namesFromColumn에서 결정합니다.
  headerLike: boolean; // 첫 행이 머리글로 보이는지
  score: number; // 이름 열일 가능성 (0~1)
}

export interface RosterSheet {
  name: string;
  columns: RosterColumn[];
  bestColumnIndex: number; // 후보가 하나도 없으면 -1
}

// 머리글에 흔히 쓰이는 말들. 이게 첫 칸에 있으면 그 행은 이름이 아니라 제목입니다.
const HEADER_WORDS = /이\s*름|성\s*명|성함|교사|교직원|참석|참여|대상|명단|직원|담당|번호|연번|순번|소속|부서/;

// 이름처럼 보이는 정도. 한글 이름을 가장 확실한 신호로 보고, 영문 이름은 그다음으로 봅니다.
// 숫자가 섞이거나 너무 길면 이름이 아니라 과목명·비고 같은 다른 열입니다.
function nameLikeness(value: string): number {
  if (!value || /\d/.test(value)) return 0;
  if (/^[가-힣]{2,6}$/.test(value)) return 1;
  if (/^[가-힣]{1,4}\s[가-힣]{1,4}$/.test(value)) return 0.8; // "홍 길동"처럼 띄어 쓴 경우
  if (/^[A-Za-z][A-Za-z.\-\s']{1,29}$/.test(value)) return 0.6;
  return 0;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

// 머리글이 대놓고 "성명"이라고 말해 주면 그게 가장 확실한 근거입니다.
const NAME_HEADER_WORDS = /이\s*름|성\s*명|성함|교사|교직원|참석|참여|대상|명단/;

function buildColumn(index: number, cells: string[]): RosterColumn {
  const first = cells[0] ?? "";
  const rest = cells.slice(1).filter(Boolean);
  const filled = rest.length;
  const ratio = filled === 0 ? 0 : rest.reduce((sum, v) => sum + nameLikeness(v), 0) / filled;

  // "국어/수학/영어"처럼 같은 값이 반복되는 열도 글자 모양만 보면 이름과 구별되지 않습니다.
  // 사람 이름은 거의 겹치지 않는다는 점을 이용해 반복이 많은 열을 깎습니다.
  const unique = new Set(rest).size;
  const uniqueRatio = filled === 0 ? 0 : unique / filled;

  // 이름 두어 개짜리 열이 30명짜리 열을 이기면 안 되므로 표본 수로도 눌러 줍니다.
  const headerBonus = NAME_HEADER_WORDS.test(first) ? 0.5 : 0;
  const score = ratio * Math.min(1, filled / 5) * (0.5 + 0.5 * uniqueRatio) + headerBonus;

  const headerLike = Boolean(first) && (HEADER_WORDS.test(first) || (nameLikeness(first) === 0 && ratio >= 0.6));

  return { index, letter: XLSX.utils.encode_col(index), cells, headerLike, score };
}

/** 워크북을 읽어 시트별 열 후보를 만듭니다. 브라우저에서만 호출하세요(File을 받습니다). */
export async function parseRosterWorkbook(file: File): Promise<RosterSheet[]> {
  // ⚠️ CSV는 반드시 **문자열로** 넘겨야 합니다. 바이트(type:"array")로 주면 SheetJS가 UTF-8이 아닌
  // 코드페이지로 해석해 한글 이름이 전부 깨지고, 그러면 "이름 열을 못 찾았다"는 엉뚱한 결과가 나옵니다.
  // (엑셀 파일은 압축 포맷이라 반대로 문자열로 주면 안 됩니다.)
  const isCsv = /\.(csv|txt)$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    // raw:false → 숫자·날짜도 화면에 보이는 문자열로 받습니다. defval:"" → 빈 칸도 자리를 지켜 열이 밀리지 않습니다.
    const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][]).slice(
      0,
      MAX_ROWS
    );
    const width = Math.min(MAX_COLS, rows.reduce((max, row) => Math.max(max, row.length), 0));

    const columns: RosterColumn[] = [];
    for (let c = 0; c < width; c += 1) {
      const cells = rows.map((row) => cellText(row[c]));
      if (!cells.some(Boolean)) continue; // 통째로 빈 열은 후보에서 뺍니다.
      columns.push(buildColumn(c, cells));
    }

    const best = columns.reduce<RosterColumn | null>(
      (top, col) => (col.score > 0 && (!top || col.score > top.score) ? col : top),
      null
    );

    return { name: sheetName, columns, bestColumnIndex: best ? best.index : -1 };
  });
}

/** 고른 열에서 실제 명단을 뽑습니다. 공백·중복 정리는 저장 API와 같은 규칙(sanitizeRosterNames)을 씁니다. */
export function namesFromColumn(column: RosterColumn | undefined, skipHeader: boolean): string[] {
  if (!column) return [];
  return sanitizeRosterNames(skipHeader ? column.cells.slice(1) : column.cells);
}

/** 파일 이름에서 확장자를 떼어 프리셋 이름 초안으로 씁니다. */
export function suggestPresetName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xlsm|xls|csv)$/i, "").trim();
}
