// TSV 붙여넣기 → RosterModel.
// prototypes/time-allocation/public/app.js 의 parse() + 불러오기 시 과목수 누락 경고를 그대로 옮긴 것입니다.

import type { RosterGroup, RosterModel, RosterStudent, RosterSubject } from "../types";

/**
 * 엑셀에서 복사한 TSV(헤더 2줄 + 합계행 + 학생행)를 분해합니다.
 * - 첫 헤더 행: 학기 그룹 / "택N"
 * - 둘째 헤더 행: 과목명 (열 위치로 구분하므로 1·2학기 동명 과목이 섞이지 않음)
 * - 학생 행: 2번째 칸이 3자리 이상 숫자(학번)인 행만
 */
export function parseRoster(text: string): RosterModel {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  const rows = lines.map((l) => l.split("\t").map((c) => c.trim()));
  const hi = rows.findIndex((r) => r.includes("학번"));
  if (hi < 0 || hi + 1 >= rows.length) throw new Error("헤더(학번 행)를 찾지 못했습니다.");
  const h1 = rows[hi];
  const h2 = rows[hi + 1];
  let start = h1.indexOf("과목수") + 1;
  if (start <= 0) start = 7;
  const width = Math.max(h1.length, h2.length);

  const groups: RosterGroup[] = [];
  const subjects: RosterSubject[] = [];
  let g: RosterGroup | null = null;
  for (let c = start; c < width; c++) {
    if (h1[c]) {
      const m = h1[c].match(/택\s*(\d+)/);
      g = { name: h1[c], pick: m ? +m[1] : 0, cols: [] };
      groups.push(g);
    }
    const name = h2[c];
    if (!name) continue;
    if (!g) {
      g = { name: "기타", pick: 0, cols: [] };
      groups.push(g);
    }
    const s: RosterSubject = { idx: subjects.length, name, group: groups.length - 1, count: 0, col: c };
    subjects.push(s);
    g.cols.push(s.idx);
  }
  if (!subjects.length) throw new Error("과목 행을 찾지 못했습니다.");

  const students: RosterStudent[] = [];
  for (let r = hi + 2; r < rows.length; r++) {
    const row = rows[r];
    if (!/^\d{3,}$/.test(row[1] || "")) continue; // 합계 등 건너뜀
    const choices: number[] = [];
    for (const s of subjects) {
      if ((row[s.col] || "") !== "") {
        choices.push(s.idx);
        s.count++;
      }
    }
    students.push({
      no: row[0],
      id: row[1],
      name: row[2],
      cnt: +row[6] || 0,
      choices,
    });
  }
  if (!students.length) throw new Error("학생 행을 찾지 못했습니다.");

  const model: RosterModel = { groups, subjects, students };
  const warning = missingColumnWarning(model);
  if (warning) model.warning = warning;
  return model;
}

/**
 * 각 학생의 "과목수" 열과 실제 파싱된 선택 수가 다르면 경고 문구를 만듭니다.
 * (엑셀에 숨겨진 열이 있어 통째로 빠지는 실제 사고가 있었음 — README 6절.)
 */
export function missingColumnWarning(model: RosterModel): string | undefined {
  const bad = model.students.filter((st) => st.cnt && st.cnt !== st.choices.length);
  if (!bad.length) return undefined;
  const diff = bad.reduce((a, st) => a + (st.cnt - st.choices.length), 0);
  return `경고: ${bad.length}명은 과목수(${bad[0].cnt})와 실제 선택 수(${bad[0].choices.length})가 다릅니다. 총 ${diff}개 선택이 누락된 것으로 보입니다. 엑셀에 숨겨진 열이 있는지 확인하세요.`;
}
