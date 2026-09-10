// 합성 샘플 데이터 생성 (구조만 동일, 이름/학번은 가짜)
const g1 = ['언어생활 탐구','미적분Ⅱ','심화 영어','동아시아 역사 기행','한국지리 탐구','인문학과 윤리','정치','법과 사회','전자기와 양자','화학 반응의 세계','생물의 유전','행성우주과학','인공지능 기초'];
const g2 = ['교육의 이해','논리와 사고','보건','인간과 심리','인간과 경제활동'];
const g3 = ['문학과 영상','주제 탐구 독서','경제수학','수학과제 탐구','수학과 문화','심화 영어','심화 영어 독해와 작문','세계 문화와 영어','도시의 미래 탐구','인문학과 윤리','역사로 탐구하는 현대 세계','기후변화와 지속가능한 세계','사회문제탐구','융합과학 탐구','기후변화와 환경생태','인공지능 기초'];
const w3 = [81,136,28,120,58,84,21,79,57,14,95,131,161,137,143,139,36];
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function pick(arr, k, weights) {
  const out = new Set();
  while (out.size < k) {
    const tot = weights.reduce((a, b) => a + b, 0); let r = rnd() * tot;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r < 0) { out.add(i); break; } }
  }
  return out;
}
const head1 = ['순번','학번','이름','성별','과정','메모','과목수','1학기 [택4]', ...Array(g1.length-1).fill(''), '1학기 [택1]', ...Array(g2.length-1).fill(''), '2학기 [택8]', ...Array(g3.length-1).fill('')];
const head2 = ['','','','','','','', ...g1, ...g2, ...g3];
const lines = [head1.join('\t'), head2.join('\t'), ['합계','','','','','','' ].join('\t')];
let n = 0;
for (let c = 1; c <= 8; c++) for (let s = 1; s <= 24; s++) {
  n++;
  const id = `20${c}${String(s).padStart(2,'0')}`;
  const a = pick(g1, 4, g1.map(() => 1)), b = pick(g2, 1, g2.map(() => 1)), d = pick(g3, 8, w3);
  const row = [n, id, `학생${n}`, '남', '1', '', 13,
    ...g1.map((_, i) => a.has(i) ? '1' : ''), ...g2.map((_, i) => b.has(i) ? '1' : ''), ...g3.map((_, i) => d.has(i) ? '1' : '')];
  lines.push(row.join('\t'));
}
require('fs').writeFileSync('public/sample.tsv', lines.join('\n'), 'utf8');
console.log('rows', lines.length);
