/* 타임 변경 가능성 분석
   assignment.csv: 학번;A타임;...;J타임  (배정 결과, 다른 학생은 그대로 유지)
   공통과목(논술 / 체육진로)이 놓인 타임은 그 학생에게 사용 불가.
   각 (학생, 빼는 과목 X, 넣는 과목 Y)에 대해 변경 가능 여부를 판정한다. */
'use strict';
const fs = require('fs');
const path = require('path');

const CAP = +(process.argv[2] || 29);
const COMMON = new Set(['논술', '체육진로']);
const T = 10;

const rows = fs.readFileSync(path.join(__dirname, 'assignment.csv'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(';'));

const subjIdx = new Map();
const subjName = [];
const id = (n) => { if (!subjIdx.has(n)) { subjIdx.set(n, subjName.length); subjName.push(n); } return subjIdx.get(n); };

const students = rows.map(r => {
  const sid = r[0], cells = r.slice(1);
  if (cells.length !== T) throw new Error(`${sid}: 타임 수 ${cells.length}`);
  const blocked = [], picks = new Map();   // subjIdx -> time
  cells.forEach((name, t) => {
    if (COMMON.has(name)) { blocked.push(t); return; }
    picks.set(id(name), t);
  });
  if (blocked.length !== 2) throw new Error(`${sid}: 공통과목 ${blocked.length}개`);
  if (picks.size !== 8) throw new Error(`${sid}: 선택과목 ${picks.size}개`);
  return { sid, cls: sid.slice(0, -2), blocked, picks };
});

const S = subjName.length;
const load = Array.from({ length: S }, () => new Array(T).fill(0));
const offered = Array.from({ length: S }, () => new Set());
for (const st of students) for (const [s, t] of st.picks) { load[s][t]++; offered[s].add(t); }

/* --- 검증: 과목별 총원, 분반 수, 최대 정원 --- */
console.log(`학생 ${students.length}명, 선택과목 ${S}개, 타임 ${T}개, 정원 ${CAP}\n`);
console.log('과목별 현황 (총원 / 분반수 / 분반 인원)');
const bySize = subjName.map((n, s) => ({ n, s, tot: load[s].reduce((a, b) => a + b, 0), secs: offered[s].size }))
  .sort((a, b) => b.tot - a.tot);
let maxLoad = 0;
for (const x of bySize) {
  const ls = [...offered[x.s]].sort((a, b) => a - b).map(t => load[x.s][t]);
  maxLoad = Math.max(maxLoad, ...ls);
  console.log(`  ${x.n.padEnd(18)} ${String(x.tot).padStart(4)}  ${x.secs}분반  [${ls.join(',')}]`);
}
console.log(`\n총 수강 ${bySize.reduce((a, x) => a + x.tot, 0)} (= 학생수 x 8 = ${students.length * 8}), 최대 분반 인원 ${maxLoad}\n`);

/* --- 학생 한 명만 재배치하는 완전 매칭 --- */
function canPlace(subs, blocked, loadOther) {
  const times = [...Array(T).keys()].filter(t => !blocked.includes(t));
  const adj = subs.map(s => times.filter(t => offered[s].has(t) && loadOther[s][t] < CAP));
  const matchT = new Array(T).fill(-1);
  const tryK = (i, seen) => {
    for (const t of adj[i]) {
      if (seen[t]) continue; seen[t] = true;
      if (matchT[t] < 0 || tryK(matchT[t], seen)) { matchT[t] = i; return true; }
    }
    return false;
  };
  const order = subs.map((_, i) => i).sort((a, b) => adj[a].length - adj[b].length);
  let n = 0;
  for (const i of order) if (tryK(i, new Array(T).fill(false))) n++;
  return n === subs.length;
}

/* --- 모든 (학생, X, Y) 조합 검사 --- */
let total = 0, sameTime = 0, needShuffle = 0, impossible = 0;
const byTarget = subjName.map(() => ({ tot: 0, same: 0, shuf: 0, imp: 0 }));
const bySource = subjName.map(() => ({ tot: 0, imp: 0 }));
const perStudent = [];

for (const st of students) {
  const cur = [...st.picks.keys()];
  const loadOther = load.map(r => r.slice());
  for (const [s, t] of st.picks) loadOther[s][t]--;   // 본인 기여 제거
  let impHere = 0;
  for (const X of cur) {
    for (let Y = 0; Y < S; Y++) {
      if (st.picks.has(Y)) continue;
      total++; byTarget[Y].tot++; bySource[X].tot++;
      const tX = st.picks.get(X);
      if (offered[Y].has(tX) && loadOther[Y][tX] < CAP) { sameTime++; byTarget[Y].same++; continue; }
      const subs = cur.filter(s => s !== X).concat(Y);
      if (canPlace(subs, st.blocked, loadOther)) { needShuffle++; byTarget[Y].shuf++; }
      else { impossible++; byTarget[Y].imp++; bySource[X].imp++; impHere++; }
    }
  }
  perStudent.push({ sid: st.sid, imp: impHere });
}

const pct = (x) => (100 * x / total).toFixed(2) + '%';
console.log('=== 전체 경우의 수 대비 결과 ===');
console.log(`전체 경우의 수            ${total}  (학생 ${students.length} x 현재과목 8 x 대체과목 ${S - 8})`);
console.log(`(1) 같은 타임에서 즉시 교체  ${sameTime}  ${pct(sameTime)}`);
console.log(`(2) 본인 시간표 재배치 필요  ${needShuffle}  ${pct(needShuffle)}`);
console.log(`(3) 변경 불가능             ${impossible}  ${pct(impossible)}`);
console.log(`가능 합계 (1)+(2)          ${sameTime + needShuffle}  ${pct(sameTime + needShuffle)}\n`);

console.log('바꿔 들어가려는 과목(Y)별 불가능 비율');
byTarget.map((v, s) => ({ n: subjName[s], ...v }))
  .sort((a, b) => b.imp / b.tot - a.imp / a.tot)
  .forEach(v => console.log(`  ${v.n.padEnd(18)} 불가 ${String(v.imp).padStart(4)}/${v.tot}  ${(100 * v.imp / v.tot).toFixed(1)}%   (즉시 ${(100 * v.same / v.tot).toFixed(0)}%)`));

const zero = perStudent.filter(p => !p.imp).length;
const worst = perStudent.slice().sort((a, b) => b.imp - a.imp)[0];
console.log(`\n모든 변경이 가능한 학생 ${zero}/${students.length}명, 불가 경우가 가장 많은 학생 ${worst.sid} (${worst.imp}/${8 * (S - 8)})`);
