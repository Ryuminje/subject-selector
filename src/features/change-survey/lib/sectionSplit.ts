// 같은 타임·같은 과목이 여러 칸(반)에 열렸을 때 학생을 칸에 나누는 규칙 — 타임별 명단(변경 전·후)과 엑셀 내보내기가 같이 쓴다.
//  · 학생에게 분반 번호가 있으면(타임 배정의 "B1"/"B2") 그 번호의 칸에 넣는다.
//  · 분반 정보가 아무에게도 없으면(직접 올린 파일 등) 예전처럼 학번순으로 앞에서부터 같은 인원씩 나눈다.
//  · 일부 학생만 분반이 정해져 있으면(과목을 바꿔 들어온 학생 등) 나머지는 인원이 가장 적은 칸에 넣는다.

export interface SectionColumn {
  col: string;
  /** 칸 이름 끝의 숫자(현대사회와 윤리1 → 1), 없으면 1 */
  num: number;
}

/**
 * students 는 학번순으로 정렬해서 넘긴다. cols 는 num 오름차순.
 * 칸 이름에 번호가 없거나 겹치면(같은 이름의 칸이 여럿) 칸 순서대로 1, 2, … 번으로 본다.
 * 반환: 칸 이름 → 그 칸의 학생들(학번순).
 */
export function splitIntoColumns<S>(students: S[], cols: SectionColumn[], sectionOf: (s: S) => number | undefined): Record<string, S[]> {
  const out: Record<string, S[]> = {};
  cols.forEach((c) => (out[c.col] = []));
  if (cols.length === 0) return out;

  const distinct = new Set(cols.map((c) => c.num)).size === cols.length;
  const ord = distinct ? cols.map((c) => c.num) : cols.map((_, i) => i + 1);

  const rest: S[] = [];
  let placed = 0;
  for (const s of students) {
    const n = sectionOf(s);
    const i = n === undefined ? -1 : ord.indexOf(n);
    if (i >= 0) {
      out[cols[i].col].push(s);
      placed++;
    } else rest.push(s);
  }

  if (placed === 0) {
    const base = Math.floor(rest.length / cols.length);
    const extra = rest.length % cols.length;
    let at = 0;
    cols.forEach((c, idx) => {
      const n = base + (idx < extra ? 1 : 0);
      out[c.col].push(...rest.slice(at, at + n));
      at += n;
    });
  } else {
    for (const s of rest) {
      let best = 0;
      cols.forEach((c, i) => {
        if (out[c.col].length < out[cols[best].col].length) best = i;
      });
      out[cols[best].col].push(s);
    }
    // 나중에 들어온 학생이 섞여도 칸 안은 학번순을 유지한다
    const order = new Map(students.map((s, i) => [s, i]));
    cols.forEach((c) => out[c.col].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
  }
  return out;
}
