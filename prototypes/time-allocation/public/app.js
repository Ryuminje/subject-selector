/* 선택과목 타임(구획) 배정 — 클라이언트 전용 */
(() => {
'use strict';

const $ = (s) => document.querySelector(s);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const state = {
  groups: [],      // {name, pick, cols:[subjIdx...]}
  subjects: [],    // {idx, name, group, count, col}
  students: [],    // {no, id, name, gender, course, memo, choices:Set(subjIdx)}
  cap: 29, allowOver: false, startLetter: 0, numTimes: 8,
  selected: [], sections: [], fixed: [],
  placement: [],   // subjIdx -> Set(timeIdx)
  assign: null,    // {byStudent: [Map(subj->time)], unassigned: [[subj...]], load: [[t]]}
  confirmed: false,
  // 반 고정 공통과목: 학점 합이 타임 시수를 넘지 않는 과목들을 하나의 '구획'으로 묶어
  // 반별로 타임을 고정한다. 예: 3학점 한 과목이 한 구획, 2학점+1학점이 또 한 구획.
  common: {
    on: true, hours: 3,
    subjects: [
      { name: '3학점 과목', credits: 3, teachers: 2, band: 0 },
      { name: '2학점 과목', credits: 2, teachers: 2, band: 1 },
      { name: '1학점 과목', credits: 1, teachers: 8, band: 1 },
    ],
  },
  classes: [],     // 반 키 목록 (학번에서 마지막 두 자리 제거)
  bandTimes: [],   // 구획 index -> { 반 키: 타임 index }
};

const classKey = (id) => id.length > 2 ? id.slice(0, -2) : id;
const classLabel = (key) => (key.length > 1 && /^\d+$/.test(key)) ? (+key.slice(1)) + '반' : key + '반';

/* 공통과목을 구획(band)으로 묶는다. band 번호가 같은 과목은 한 타임을 시수로 나눠 쓴다. */
function bandList() {
  if (!state.common.on) return [];
  const map = new Map();
  state.common.subjects.forEach(s => {
    if (!map.has(s.band)) map.set(s.band, []);
    map.get(s.band).push(s);
  });
  return [...map.keys()].sort((a, b) => a - b).map(b => ({
    key: b,
    subjects: map.get(b),
    credits: map.get(b).reduce((a, s) => a + s.credits, 0),
    // 한 타임에 동시에 들어갈 수 있는 반 수는 구획 안 과목의 교사 수 중 가장 적은 값
    perTime: Math.max(1, Math.min(...map.get(b).map(s => s.teachers))),
  }));
}

/* 학점 합이 타임 시수를 넘지 않도록 과목을 구획에 다시 채운다(큰 학점부터 first-fit). */
function autoPackBands() {
  const H = Math.max(1, state.common.hours), subs = state.common.subjects;
  const order = subs.map((_, i) => i).sort((a, b) => subs[b].credits - subs[a].credits);
  const bins = [];
  for (const i of order) {
    const c = subs[i].credits;
    let b = bins.find(x => x.sum + c <= H);
    if (!b) { b = { sum: 0, items: [] }; bins.push(b); }
    b.sum += c; b.items.push(i);
  }
  bins.forEach((b, bi) => b.items.forEach(i => { subs[i].band = bi; }));
}

/* 구획별 타임 고정: 교사 n명이면 한 타임에 최대 n개 반 → ceil(반수/n)개 타임에 분산.
   학생 점유가 가장 적은 타임부터 넣되, 같은 반이 두 구획에서 같은 타임을 쓰지 않게 한다. */
function computeFixedBands() {
  state.bandTimes = [];
  if (!state.common.on || !state.classes.length) return '';
  const bands = bandList();
  if (!bands.length) return '';
  const over = bands.filter(b => b.credits > state.common.hours);
  const T = state.numTimes, C = state.classes.length;
  const sizeOf = (key) => state.students.filter(st => classKey(st.id) === key).length;
  const chunk = (n) => {            // 반을 ceil(C/n)개 묶음으로 균등 분할
    const k = Math.max(1, Math.ceil(C / n)), out = [];
    for (let i = 0; i < k; i++) out.push(state.classes.filter((_, j) => j % k === i));
    return out;
  };
  const occ = new Array(T).fill(0);   // 타임별 공통과목 점유 학생 수
  const used = new Map();             // 반 키 -> 이미 쓴 타임 Set
  for (const band of bands) {
    const map = {};
    for (const g of chunk(band.perTime)) {
      const cand = [...Array(T).keys()]
        .filter(t => g.every(c => !(used.get(c) || new Set()).has(t)))
        .sort((a, b) => occ[a] - occ[b] || a - b);
      if (!cand.length) {
        state.bandTimes = [];
        return `타임 수가 부족하여 공통과목을 배치할 수 없습니다. 타임 수를 ${bands.length + 8} 이상으로 늘리세요.`;
      }
      const t = cand[0];
      g.forEach(c => {
        map[c] = t; occ[t] += sizeOf(c);
        if (!used.has(c)) used.set(c, new Set());
        used.get(c).add(t);
      });
    }
    state.bandTimes.push(map);
  }
  if (over.length) return `구획 ${over.map(b => b.key + 1).join(', ')}의 학점 합이 타임 시수(${state.common.hours})를 넘습니다.`;
  return '';
}

function blockedBands(st) {
  if (!state.common.on) return [];
  const k = classKey(st.id);
  return state.bandTimes.map(m => m[k]).filter(t => t !== undefined);
}

/* ---------- 파싱 ---------- */
function parse(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  const rows = lines.map(l => l.split('\t').map(c => c.trim()));
  const hi = rows.findIndex(r => r.includes('학번'));
  if (hi < 0 || hi + 1 >= rows.length) throw new Error('헤더(학번 행)를 찾지 못했습니다.');
  const h1 = rows[hi], h2 = rows[hi + 1];
  let start = h1.indexOf('과목수') + 1;
  if (start <= 0) start = 7;
  const width = Math.max(h1.length, h2.length);

  const groups = [], subjects = [];
  let g = null;
  for (let c = start; c < width; c++) {
    if (h1[c]) {
      const m = h1[c].match(/택\s*(\d+)/);
      g = { name: h1[c], pick: m ? +m[1] : 0, cols: [] };
      groups.push(g);
    }
    const name = h2[c];
    if (!name) continue;
    if (!g) { g = { name: '기타', pick: 0, cols: [] }; groups.push(g); }
    const s = { idx: subjects.length, name, group: groups.length - 1, count: 0, col: c };
    subjects.push(s); g.cols.push(s.idx);
  }
  if (!subjects.length) throw new Error('과목 행을 찾지 못했습니다.');

  const students = [];
  for (let r = hi + 2; r < rows.length; r++) {
    const row = rows[r];
    if (!/^\d{3,}$/.test(row[1] || '')) continue;  // 합계 등 건너뜀
    const st = { no: row[0], id: row[1], name: row[2], gender: row[3], course: row[4], memo: row[5], cnt: +row[6] || 0, choices: new Set() };
    for (const s of subjects) {
      if ((row[s.col] || '') !== '') { st.choices.add(s.idx); s.count++; }
    }
    students.push(st);
  }
  if (!students.length) throw new Error('학생 행을 찾지 못했습니다.');
  return { groups, subjects, students };
}

function loadData(text) {
  const d = parse(text);
  Object.assign(state, d);
  const last = state.groups[state.groups.length - 1];
  state.classes = [...new Set(state.students.map(st => classKey(st.id)))].sort();
  state.numTimes = (last.pick || Math.min(8, last.cols.length)) + bandList().length;
  state.selected = state.subjects.map(s => s.group === state.groups.length - 1);
  state.fixed = state.subjects.map(() => false);
  state.confirmed = false;
  resetPlacement();
  msg('#common-msg', computeFixedBands(), true);
}

function defaultSections(s) {
  return Math.max(1, Math.ceil(state.subjects[s].count / state.cap));
}
function resetPlacement() {
  state.sections = state.subjects.map((_, i) => defaultSections(i));
  state.placement = state.subjects.map(() => new Set());
  state.assign = null;
}

/* ---------- 배정 (학생별 이분 매칭) ---------- */
function runAssign() {
  const T = state.numTimes, cap = state.cap, over = state.allowOver;
  const S = state.subjects.length;
  const load = Array.from({ length: S }, () => new Array(T).fill(0));
  const byStudent = [], unassigned = [];

  const stuSubs = state.students.map(st => [...st.choices].filter(s => state.selected[s]));
  const order = state.students.map((_, i) => i);
  const optCount = (i) => stuSubs[i].reduce((a, s) => a + state.placement[s].size, 0);
  order.sort((a, b) => optCount(a) - optCount(b) || a - b);

  const match = (subs, useCap, blocked) => {
    const matchR = new Array(T).fill(-1);
    const adj = subs.map(s => [...state.placement[s]]
      .filter(t => !blocked.includes(t) && (!useCap || load[s][t] < cap))
      .sort((a, b) => load[s][a] - load[s][b]));
    const dfs = (i, vis) => {
      for (const t of adj[i]) {
        if (vis[t]) continue; vis[t] = true;
        if (matchR[t] < 0 || dfs(matchR[t], vis)) { matchR[t] = i; return true; }
      }
      return false;
    };
    // 옵션이 적은 과목부터
    const idx = subs.map((_, i) => i).sort((a, b) => adj[a].length - adj[b].length);
    for (const i of idx) dfs(i, new Array(T).fill(false));
    const res = new Map();
    matchR.forEach((i, t) => { if (i >= 0) res.set(subs[i], t); });
    return res;
  };

  for (const i of order) {
    const subs = stuSubs[i], blocked = blockedBands(state.students[i]);
    let res = match(subs, true, blocked);
    if (res.size < subs.length && over) res = match(subs, false, blocked);
    byStudent[i] = res;
    unassigned[i] = subs.filter(s => !res.has(s));
    for (const [s, t] of res) load[s][t]++;
  }
  state.assign = { byStudent, unassigned, load };
  return state.assign;
}

function cost() {
  const a = runAssign();
  let un = 0, over = 0, imb = 0;
  a.unassigned.forEach(u => un += u.length);
  state.subjects.forEach((s, i) => {
    if (!state.selected[i] || !state.placement[i].size) return;
    const avg = s.count / state.placement[i].size;
    for (const t of state.placement[i]) {
      const l = a.load[i][t];
      if (l > state.cap) over += l - state.cap;
      imb += (l - avg) * (l - avg);
    }
  });
  return un * 1000 + over * 20 + imb * 0.05;
}

/* ---------- 최적화 ---------- */
function coMatrix() {
  const S = state.subjects.length;
  const co = Array.from({ length: S }, () => new Array(S).fill(0));
  for (const st of state.students) {
    const c = [...st.choices].filter(s => state.selected[s]);
    for (const a of c) for (const b of c) if (a !== b) co[a][b]++;
  }
  return co;
}

function pickTimes(s, k, co, exclude) {
  const T = state.numTimes;
  const seats = new Array(T).fill(0);
  const inT = Array.from({ length: T }, () => []);
  state.subjects.forEach((_, u) => {
    if (u === s || !state.selected[u]) return;
    for (const t of state.placement[u]) { seats[t] += state.cap; inT[t].push(u); }
  });
  const score = (t) => inT[t].reduce((a, u) => a + co[s][u] / state.placement[u].size, 0) + 0.02 * seats[t];
  return [...Array(T).keys()].filter(t => !exclude.has(t))
    .sort((a, b) => score(a) - score(b)).slice(0, k);
}

function initialPlacement(co) {
  const order = state.subjects.map((_, i) => i).filter(i => state.selected[i])
    .sort((a, b) => state.subjects[b].count - state.subjects[a].count);
  for (const s of order) {
    if (state.fixed[s] && state.placement[s].size) continue;
    const k = Math.min(state.sections[s], state.numTimes);
    state.placement[s] = new Set(pickTimes(s, k, co, new Set()));
  }
}

function optimize(budgetMs = 2000) {
  const co = coMatrix();
  initialPlacement(co);
  let best = cost();
  const movable = state.subjects.map((_, i) => i)
    .filter(i => state.selected[i] && !state.fixed[i] && state.placement[i].size > 0 && state.placement[i].size < state.numTimes);
  const t0 = performance.now();
  let iter = 0;
  while (movable.length && performance.now() - t0 < budgetMs) {
    iter++;
    const s = movable[Math.floor(Math.random() * movable.length)];
    const cur = [...state.placement[s]];
    const t1 = cur[Math.floor(Math.random() * cur.length)];
    const free = [...Array(state.numTimes).keys()].filter(t => !state.placement[s].has(t));
    const t2 = free[Math.floor(Math.random() * free.length)];
    state.placement[s].delete(t1); state.placement[s].add(t2);
    const c = cost();
    if (c <= best) best = c;
    else { state.placement[s].delete(t2); state.placement[s].add(t1); }
  }
  runAssign();
  return { best, iter };
}

/* ---------- 렌더링 ---------- */
const timeLabel = (t) => LETTERS[(state.startLetter + t) % 26];
const groupClass = (g) => 'grp' + ((g % 3) + 1);

function renderGrid() {
  const el = $('#grid');
  if (!state.subjects.length) { el.innerHTML = '<p class="hint" style="padding:12px">먼저 데이터를 불러오세요.</p>'; return; }
  const T = state.numTimes, subs = state.subjects, a = state.assign;
  const dis = state.confirmed ? ' disabled' : '';
  let h = '<table class="grid' + (state.confirmed ? ' confirmed' : '') + '">';

  // 그룹 헤더
  h += '<tr><th rowspan="2">타임<br>(이수과목)</th><th rowspan="2">인원(반)<br>학생 ' + state.students.length + '명</th>';
  state.groups.forEach((g, gi) => {
    const all = g.cols.every(s => state.selected[s]);
    h += `<th class="${groupClass(gi)}" colspan="${g.cols.length}">${g.name} <input type="checkbox" data-grp="${gi}" ${all ? 'checked' : ''}${dis}></th>`;
  });
  // 한 구획의 과목들은 같은 타임을 시수로 나눠 쓴다. 학생은 그 타임에 한 번만 들어가므로
  // 타임별 인원·반 집계에서는 구획의 첫 과목에서만 세고 나머지(shared)는 건너뛴다.
  const bands = bandList();
  const com = [];
  bands.forEach((b, bi) => b.subjects.forEach((s, j) => com.push({
    name: s.name, bandIdx: bi, note: `구획${bi + 1} · ${s.credits}학점<br>교사 ${s.teachers}명`, shared: j > 0,
  })));
  if (com.length) h += `<th class="grp4" colspan="${com.length}">반 고정 공통 [${bands.map(b => b.subjects.map(s => s.credits).join('+')).join(' | ')}]</th>`;
  h += '</tr><tr>';
  subs.forEach(s => h += `<th class="subj ${state.selected[s.idx] ? '' : 'off'}">${s.name}</th>`);
  com.forEach(c => h += `<th class="subj com">${c.name}</th>`);
  h += '</tr>';
  const comCells = (fn) => com.map(c => `<td class="com">${fn(c)}</td>`).join('');
  const classesAt = (c, t) => state.classes.filter(k => (state.bandTimes[c.bandIdx] || {})[k] === t);
  const studentsOf = (keys) => state.students.filter(st => keys.includes(classKey(st.id))).length;

  // 전체합계
  h += `<tr class="total"><td class="left"><b>전체합계</b></td><td><b>${state.students.length}</b></td>`;
  subs.forEach(s => h += `<td><b>${s.count}</b></td>`);
  h += comCells(() => `<b>${state.students.length}</b>`) + '</tr>';
  // 분반 설정
  h += '<tr><td class="left">분반 설정(필요시)</td><td></td>';
  subs.forEach(s => h += `<td><input class="sec" type="number" min="0" max="${T}" data-sec="${s.idx}" value="${state.sections[s.idx]}" ${state.selected[s.idx] ? '' : 'disabled'}${dis}></td>`);
  h += comCells(c => `<small>${c.note}</small>`) + '</tr>';
  // 배정과목 선택
  h += '<tr><td class="left">배정과목 선택</td><td></td>';
  subs.forEach(s => h += `<td><input type="checkbox" data-sel="${s.idx}" ${state.selected[s.idx] ? 'checked' : ''}${dis}></td>`);
  h += comCells(() => '<small>반 고정</small>') + '</tr>';
  // 인원설정 고정
  h += '<tr><td class="left">인원설정 고정</td><td></td>';
  subs.forEach(s => h += `<td><input type="checkbox" data-fix="${s.idx}" ${state.fixed[s.idx] ? 'checked' : ''}${dis}></td>`);
  h += comCells(() => '<small>고정</small>') + '</tr>';

  // 타임 행
  for (let t = 0; t < T; t++) {
    let stu = 0, secs = 0;
    subs.forEach(s => { if (state.selected[s.idx] && state.placement[s.idx].has(t)) { secs++; stu += a ? a.load[s.idx][t] : 0; } });
    com.forEach(c => {
      if (c.shared) return;   // 2학점과 같은 구획이므로 이미 셈에 들어가 있다
      const ks = classesAt(c, t);
      if (ks.length) { secs += ks.length; stu += studentsOf(ks); }
    });
    h += `<tr><td class="time-head">${timeLabel(t)}타임<br><small>(과목${t + 1})</small></td><td>${stu}(${secs})</td>`;
    subs.forEach(s => {
      const i = s.idx;
      if (!state.selected[i]) { h += '<td></td>'; return; }
      if (!state.placement[i].has(t)) { h += `<td class="na" data-cell="${i},${t}"></td>`; return; }
      const n = a ? a.load[i][t] : 0;
      const cls = n > state.cap ? ' over' : (n === state.cap ? ' full' : '');
      h += `<td class="cell${cls}" data-cell="${i},${t}">${n}</td>`;
    });
    com.forEach(c => {
      const ks = classesAt(c, t), cls = 'com fixed' + (c.shared ? ' shared' : '');
      h += ks.length ? `<td class="${cls}">${studentsOf(ks)}<br><small>${ks.map(classLabel).join(',')}</small></td>` : '<td class="na"></td>';
    });
    h += '</tr>';
  }

  // 합계 행들
  let asgTot = 0, unTot = 0, unStu = 0, fullStu = 0;
  const asg = subs.map(() => 0), un = subs.map(() => 0);
  if (a) {
    a.byStudent.forEach((m) => { for (const s of m.keys()) asg[s]++; asgTot += m.size; });
    a.unassigned.forEach(u => { u.forEach(s => un[s]++); unTot += u.length; if (u.length) unStu++; else fullStu++; });
  }
  const N = state.students.length;
  h += `<tr class="total"><td class="left">배정(명)</td><td>${asgTot}(${fullStu})</td>`;
  subs.forEach(s => h += `<td>${state.selected[s.idx] ? asg[s.idx] : ''}</td>`);
  h += comCells(() => N) + `</tr><tr class="total"><td class="left">미배정(명)</td><td class="un">${unTot}(${unStu})</td>`;
  subs.forEach(s => h += `<td class="${un[s.idx] ? 'un' : ''}">${state.selected[s.idx] ? un[s.idx] : ''}</td>`);
  h += comCells(() => 0) + `</tr><tr class="total"><td class="left">합계(명)</td><td>${asgTot + unTot}(${N})</td>`;
  subs.forEach(s => h += `<td>${state.selected[s.idx] ? s.count : 0}</td>`);
  h += comCells(() => N) + '</tr></table>';
  el.innerHTML = h;
}

function renderStudents() {
  const el = $('#student-table');
  if (!state.assign) { el.innerHTML = '<p class="hint" style="padding:12px">배정을 먼저 실행하세요.</p>'; return; }
  const T = state.numTimes, a = state.assign, onlyUn = $('#only-unassigned').checked;
  let h = '<table class="grid student"><tr><th>순번</th><th>학번</th><th>반</th><th>이름</th>';
  for (let t = 0; t < T; t++) h += `<th>${timeLabel(t)}</th>`;
  h += '<th>미배정</th></tr>';
  state.students.forEach((st, i) => {
    const m = a.byStudent[i], u = a.unassigned[i];
    if (onlyUn && !u.length) return;
    const byT = studentRow(i);
    h += `<tr><td>${st.no}</td><td>${st.id}</td><td>${classLabel(classKey(st.id))}</td><td>${st.name}</td>`;
    byT.forEach((n, t) => h += `<td class="${blockedBands(st).includes(t) ? 'com' : ''}">${n}</td>`);
    h += `<td class="${u.length ? 'un' : ''}">${u.map(s => state.subjects[s].name).join(', ')}</td></tr>`;
  });
  el.innerHTML = h + '</table>';
}

/* 학생 i의 타임별 과목명 배열 (선택과목 + 반 고정 공통과목) */
function studentRow(i) {
  const st = state.students[i], byT = new Array(state.numTimes).fill('');
  for (const [s, t] of state.assign.byStudent[i]) byT[t] = state.subjects[s].name;
  if (state.common.on) {
    const k = classKey(st.id);
    bandList().forEach((b, bi) => {
      const t = (state.bandTimes[bi] || {})[k];
      if (t !== undefined) byT[t] = b.subjects.map(s => s.name).join(' + ');
    });
  }
  return byT;
}

function studentsTSV() {
  const T = state.numTimes, a = state.assign;
  const out = [['순번', '학번', '반', '이름', ...Array.from({ length: T }, (_, t) => timeLabel(t) + '타임'), '미배정'].join('\t')];
  state.students.forEach((st, i) => {
    out.push([st.no, st.id, classLabel(classKey(st.id)), st.name, ...studentRow(i), a.unassigned[i].map(s => state.subjects[s].name).join(', ')].join('\t'));
  });
  return out.join('\n');
}

function renderPreview() {
  const el = $('#preview');
  if (!state.subjects.length) { el.innerHTML = ''; return; }
  let h = `<p class="hint">학생 <b>${state.students.length}</b>명, 과목 <b>${state.subjects.length}</b>개, 그룹: `;
  h += state.groups.map(g => `${g.name}(${g.cols.length}과목)`).join(', ') + '</p>';
  h += '<table class="grid"><tr><th>그룹</th><th>과목</th><th>인원</th></tr>';
  state.subjects.forEach(s => h += `<tr><td>${state.groups[s.group].name}</td><td>${s.name}</td><td>${s.count}</td></tr>`);
  el.innerHTML = h + '</table>';
}

function msg(sel, text, err) { const e = $(sel); e.textContent = text; e.className = 'msg' + (err ? ' err' : ''); }

function syncSettings() {
  const sl = $('#start-letter'), nt = $('#num-times');
  sl.innerHTML = [...LETTERS].map((c, i) => `<option value="${i}" ${i === state.startLetter ? 'selected' : ''}>${c}</option>`).join('');
  nt.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === state.numTimes ? 'selected' : ''}>${n}</option>`).join('');
  $('#cap').value = state.cap; $('#allow-over').checked = state.allowOver;
}

function refresh() { renderGrid(); renderStudents(); }

/* ---------- 이벤트 ---------- */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'alloc') renderGrid();
  if (b.dataset.tab === 'student') renderStudents();
}));

$('#btn-load').addEventListener('click', () => {
  try {
    loadData($('#raw').value);
    syncSettings(); renderCommonList(); renderPreview(); refresh();
    const bad = state.students.filter(st => st.cnt && st.cnt !== st.choices.size);
    if (bad.length) {
      const diff = bad.reduce((a, st) => a + (st.cnt - st.choices.size), 0);
      msg('#load-msg', `불러오기 완료(학생 ${state.students.length}명, 과목 ${state.subjects.length}개) — 경고: ${bad.length}명은 과목수(${bad[0].cnt})와 실제 선택 수(${bad[0].choices.size})가 다릅니다. 총 ${diff}개 선택이 누락되었습니다. 엑셀에 숨겨진 열이 있는지 확인하세요.`, true);
    } else {
      msg('#load-msg', `불러오기 완료: 학생 ${state.students.length}명, 과목 ${state.subjects.length}개`);
    }
    document.querySelector('.tab[data-tab="alloc"]').click();
  } catch (e) { msg('#load-msg', e.message, true); }
});
$('#btn-clear').addEventListener('click', () => { $('#raw').value = ''; $('#preview').innerHTML = ''; });

$('#cap').addEventListener('change', e => { state.cap = Math.max(1, +e.target.value || 1); });
$('#allow-over').addEventListener('change', e => { state.allowOver = e.target.checked; });
$('#start-letter').addEventListener('change', e => { state.startLetter = +e.target.value; refresh(); });
$('#num-times').addEventListener('change', e => {
  state.numTimes = +e.target.value;
  state.placement.forEach(p => { for (const t of [...p]) if (t >= state.numTimes) p.delete(t); });
  msg('#common-msg', computeFixedBands(), true);
  state.assign = null; refresh();
});

/* ---------- 공통과목 편집 ---------- */
function renderCommonList() {
  const el = $('#common-list'), c = state.common;
  $('#common-on').checked = c.on;
  $('#common-hours').value = c.hours;
  if (!c.on) { el.innerHTML = ''; return; }
  const bands = bandList();
  const nBands = Math.max(bands.length, 1);
  const dis = state.confirmed ? ' disabled' : '';
  let h = '<table class="common-table"><tr><th>과목명</th><th>학점</th><th>교사 수</th><th>구획</th><th>한 타임당 반</th><th></th></tr>';
  c.subjects.forEach((s, i) => {
    const b = bands.find(x => x.key === s.band);
    const perTime = b ? b.perTime : 1;
    const times = state.classes.length ? Math.ceil(state.classes.length / perTime) : 0;
    const bad = b && b.credits > c.hours;
    h += `<tr${bad ? ' class="bad"' : ''}>
      <td><input type="text" data-cf="name" data-i="${i}" value="${s.name.replace(/"/g, '&quot;')}"${dis}></td>
      <td><input type="number" min="1" max="${c.hours}" data-cf="credits" data-i="${i}" value="${s.credits}"${dis}></td>
      <td><input type="number" min="1" data-cf="teachers" data-i="${i}" value="${s.teachers}"${dis}></td>
      <td><select data-cf="band" data-i="${i}"${dis}>${
        Array.from({ length: nBands + 1 }, (_, k) => `<option value="${k}"${k === s.band ? ' selected' : ''}>구획 ${k + 1}${k >= nBands ? ' (새로)' : ''}</option>`).join('')
      }</select></td>
      <td>${perTime}반${times ? ` · ${times}개 타임` : ''}</td>
      <td><button data-cdel="${i}"${dis}>삭제</button></td>
    </tr>`;
  });
  h += '</table>';
  const sum = bands.map(b => `구획${b.key + 1}: ${b.subjects.map(s => s.credits).join('+')}=${b.credits}/${c.hours}시수`).join(' , ');
  h += `<p class="hint small">구획 ${bands.length}개 → 선택과목 타임 외에 ${bands.length}개 타임이 더 필요합니다. ${sum}</p>`;
  el.innerHTML = h;
}

/* 공통과목 구성이 바뀌면 구획 수만큼 전체 타임 수를 맞춘다 */
function applyCommonChange(prevBands) {
  const now = bandList().length;
  if (now !== prevBands && state.groups.length) {
    state.numTimes = Math.max(1, state.numTimes + (now - prevBands));
    state.placement.forEach(p => { for (const t of [...p]) if (t >= state.numTimes) p.delete(t); });
    syncSettings();
  }
  msg('#common-msg', computeFixedBands(), true);
  state.assign = null;
  renderCommonList(); refresh();
}

const commonBox = document.querySelector('.common-box');
commonBox.addEventListener('change', e => {
  const el = e.target;
  if (state.confirmed) { renderCommonList(); return; }
  const prev = bandList().length;
  if (el.id === 'common-on') state.common.on = el.checked;
  else if (el.id === 'common-hours') { state.common.hours = Math.max(1, +el.value || 1); autoPackBands(); }
  else if (el.dataset.cf !== undefined) {
    const s = state.common.subjects[+el.dataset.i];
    if (el.dataset.cf === 'name') s.name = el.value.trim() || '공통과목';
    else if (el.dataset.cf === 'credits') s.credits = Math.max(1, Math.min(state.common.hours, +el.value || 1));
    else if (el.dataset.cf === 'teachers') s.teachers = Math.max(1, +el.value || 1);
    else if (el.dataset.cf === 'band') s.band = +el.value;
  } else return;
  applyCommonChange(prev);
});
commonBox.addEventListener('click', e => {
  const del = e.target.dataset && e.target.dataset.cdel;
  if (del === undefined || state.confirmed) return;
  const prev = bandList().length;
  state.common.subjects.splice(+del, 1);
  autoPackBands();
  applyCommonChange(prev);
});
$('#btn-common-add').addEventListener('click', () => {
  if (state.confirmed) return msg('#common-msg', '확정 상태입니다.', true);
  const prev = bandList().length;
  state.common.subjects.push({ name: '새 공통과목', credits: 1, teachers: Math.max(1, state.classes.length || 1), band: 0 });
  autoPackBands();
  applyCommonChange(prev);
});
$('#btn-common-pack').addEventListener('click', () => {
  if (state.confirmed) return msg('#common-msg', '확정 상태입니다.', true);
  const prev = bandList().length;
  autoPackBands();
  applyCommonChange(prev);
});

$('#btn-opt').addEventListener('click', () => {
  if (!state.subjects.length) return msg('#alloc-msg', '데이터가 없습니다.', true);
  if (state.confirmed) return msg('#alloc-msg', '확정 상태입니다. 확정취소 후 진행하세요.', true);
  msg('#alloc-msg', '최적화 중…');
  setTimeout(() => {
    const r = optimize(2000);
    refresh();
    const un = state.assign.unassigned.reduce((a, u) => a + u.length, 0);
    msg('#alloc-msg', `최적화 완료 (${r.iter}회 탐색, 미배정 ${un}명)`);
  }, 20);
});
$('#btn-assign').addEventListener('click', () => {
  if (!state.subjects.length) return msg('#alloc-msg', '데이터가 없습니다.', true);
  if (state.confirmed) return msg('#alloc-msg', '확정 상태입니다.', true);
  if (!state.placement.some(p => p.size)) return msg('#alloc-msg', '분반 배치가 없습니다. 먼저 ① 최적화를 실행하거나 셀을 클릭해 분반을 배치하세요.', true);
  runAssign(); refresh();
  const un = state.assign.unassigned.reduce((a, u) => a + u.length, 0);
  msg('#alloc-msg', `배정 완료 (미배정 ${un}명)`);
});
$('#btn-confirm').addEventListener('click', () => { if (!state.assign) return msg('#alloc-msg', '배정 결과가 없습니다.', true); state.confirmed = true; refresh(); msg('#alloc-msg', '확정되었습니다.'); });
$('#btn-unconfirm').addEventListener('click', () => { state.confirmed = false; refresh(); msg('#alloc-msg', '확정이 취소되었습니다.'); });
$('#btn-reset').addEventListener('click', () => { if (state.confirmed) return; resetPlacement(); refresh(); msg('#alloc-msg', '초기화되었습니다.'); });

const KEY = 'timealloc-backup';
$('#btn-backup').addEventListener('click', () => {
  localStorage.setItem(KEY, JSON.stringify({
    cap: state.cap, allowOver: state.allowOver, startLetter: state.startLetter, numTimes: state.numTimes,
    selected: state.selected, sections: state.sections, fixed: state.fixed,
    placement: state.placement.map(p => [...p]), names: state.subjects.map(s => s.name), common: state.common,
  }));
  msg('#alloc-msg', '백업 완료 (브라우저 저장소)');
});
$('#btn-restore').addEventListener('click', () => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return msg('#alloc-msg', '백업이 없습니다.', true);
  const b = JSON.parse(raw);
  if (b.names.length !== state.subjects.length) return msg('#alloc-msg', '백업의 과목 구성이 현재 데이터와 다릅니다.', true);
  Object.assign(state, { cap: b.cap, allowOver: b.allowOver, startLetter: b.startLetter, numTimes: b.numTimes, selected: b.selected, sections: b.sections, fixed: b.fixed });
  state.placement = b.placement.map(p => new Set(p));
  if (b.common && Array.isArray(b.common.subjects)) state.common = b.common;  // 구버전 백업은 무시
  msg('#common-msg', computeFixedBands(), true);
  state.confirmed = false; syncSettings(); renderCommonList(); runAssign(); refresh();
  msg('#alloc-msg', '복구 완료');
});

$('#grid').addEventListener('change', e => {
  const el = e.target;
  if (state.confirmed) return;
  if (el.dataset.sel !== undefined) {
    const s = +el.dataset.sel; state.selected[s] = el.checked;
    if (!el.checked) state.placement[s].clear(); else if (!state.sections[s]) state.sections[s] = defaultSections(s);
    state.assign = null; refresh();
  } else if (el.dataset.grp !== undefined) {
    state.groups[+el.dataset.grp].cols.forEach(s => { state.selected[s] = el.checked; if (!el.checked) state.placement[s].clear(); });
    state.assign = null; refresh();
  } else if (el.dataset.fix !== undefined) {
    state.fixed[+el.dataset.fix] = el.checked;
  } else if (el.dataset.sec !== undefined) {
    const s = +el.dataset.sec, k = Math.max(0, Math.min(state.numTimes, +el.value || 0));
    state.sections[s] = k;
    const p = state.placement[s];
    if (p.size) {
      const co = coMatrix();
      while (p.size > k) {  // 학생 수가 가장 적은 분반 제거
        const ts = [...p].sort((a, b) => (state.assign ? state.assign.load[s][a] - state.assign.load[s][b] : 0));
        p.delete(ts[0]);
      }
      if (p.size < k) pickTimes(s, k - p.size, co, p).forEach(t => p.add(t));
      runAssign();
    }
    refresh();
  }
});
$('#grid').addEventListener('click', e => {
  const td = e.target.closest('td[data-cell]');
  if (!td || state.confirmed) return;
  const [s, t] = td.dataset.cell.split(',').map(Number);
  const p = state.placement[s];
  if (p.has(t)) p.delete(t); else p.add(t);
  state.sections[s] = p.size;
  runAssign(); refresh();
});

$('#only-unassigned').addEventListener('change', renderStudents);
$('#btn-copy').addEventListener('click', async () => {
  if (!state.assign) return msg('#student-msg', '배정 결과가 없습니다.', true);
  try { await navigator.clipboard.writeText(studentsTSV()); msg('#student-msg', '복사되었습니다. 엑셀에 붙여넣으세요.'); }
  catch { msg('#student-msg', '클립보드 접근이 거부되었습니다.', true); }
});

syncSettings(); renderCommonList(); renderGrid();
})();
document.getElementById('btn-sample').addEventListener('click', async () => {
  const r = await fetch('sample.tsv'); document.getElementById('raw').value = await r.text();
  document.getElementById('btn-load').click();
});
