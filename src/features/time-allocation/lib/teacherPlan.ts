// 구획(타임) 하나의 교사 수 계산 + 실제 배치.
//
// 모델: 모든 반이 이 구획을 같은 시간에 합니다. 구획 시수 T = 과목 학점의 합이고,
// 각 반은 T개 타임에 자기 과목을 학점만큼 채웁니다(예: 논술3+체육2+진로1 = 6타임).
//
// 이름이 같은 교사는 같은 사람으로 봅니다 — 논술과 진로에 같은 이름을 적으면 겸임이고,
// 그 사람은 한 타임에 한 반에만 들어갈 수 있습니다.

export interface PlanTeacher {
  name: string;
  /** 이 과목에서 맡는 수업 시수(= 들어가는 수업 칸 수) */
  hours: number;
  /** 손으로 지정한 담당 반(0-based). 비우면 자동 배치합니다. */
  classes?: number[];
}

export interface PlanSubject {
  name: string;
  credits: number;
  teachers: PlanTeacher[];
  /** 자동 채우기에 쓸 교사 수. 비우면 최소 인원으로 채웁니다. */
  teacherCount?: number;
}

export interface PlanInput {
  classes: number;
  subjects: PlanSubject[];
}

/** 구획 시수 = 학점 합. 각 반이 이 구획에서 듣는 수업 칸 수와 같습니다. */
export const bandHours = (subjects: PlanSubject[]): number =>
  subjects.reduce((a, s) => a + Math.max(0, s.credits), 0);

/** 과목 하나에 필요한 최소 교사 수 = 올림(학점 × 반 수 ÷ 구획 시수). */
export function minTeachers(credits: number, classes: number, hours: number): number {
  if (credits <= 0 || classes <= 0 || hours <= 0) return 0;
  return Math.ceil((credits * classes) / hours);
}

/** 과목의 총 수업 칸 = 학점 × 반 수. 이 과목 교사들의 시수 합이 이 값이어야 합니다. */
export const subjectDemand = (credits: number, classes: number): number =>
  Math.max(0, credits) * Math.max(0, classes);

/** 총 시수를 n명에게 고르게 나눈 값(앞사람부터 1시간씩 더 받습니다). */
export function splitHours(demand: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(demand / n);
  const extra = demand % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * 시수를 고르게 나눈 기본 교사 목록(이름은 "과목1, 과목2…").
 * 인원은 subject.teacherCount, 없으면 최소 인원입니다.
 */
export function defaultTeachers(subject: PlanSubject, classes: number, hours: number): PlanTeacher[] {
  const demand = subjectDemand(subject.credits, classes);
  const n = Math.max(0, subject.teacherCount ?? minTeachers(subject.credits, classes, hours));
  if (!n) return [];
  return splitHours(demand, n).map((h, i) => ({ name: `${subject.name || "교사"}${i + 1}`, hours: h }));
}

export interface PlanProblem {
  kind: "demand" | "person" | "input" | "fixed";
  message: string;
}

/** 배치 전에 잡아야 하는 문제들. 비어 있으면 배치가 가능합니다. */
export function validatePlan(input: PlanInput): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const hours = bandHours(input.subjects);
  if (input.classes <= 0) problems.push({ kind: "input", message: "반 수를 1 이상으로 입력하세요." });
  if (hours <= 0) problems.push({ kind: "input", message: "학점을 1 이상으로 입력하세요." });
  if (problems.length) return problems;

  input.subjects.forEach((s) => {
    if (s.credits <= 0) return;
    const demand = subjectDemand(s.credits, input.classes);
    const given = s.teachers.reduce((a, t) => a + Math.max(0, t.hours), 0);
    if (given !== demand) {
      problems.push({
        kind: "demand",
        message: `${s.name || "이름 없는 과목"}: 교사 시수 합이 ${given}시간인데 필요한 수업 칸은 ${demand}시간입니다(학점 ${s.credits} × 반 ${input.classes}).`,
      });
    }
  });

  // 손으로 지정한 담당 반 — 같은 반을 두 교사가 맡거나, 지정한 반의 시수가 입력 시수를 넘으면 안 됩니다.
  input.subjects.forEach((s) => {
    if (s.credits <= 0) return;
    const owner = new Map<number, string>();
    s.teachers.forEach((t) => {
      const fixed = t.classes ?? [];
      if (fixed.some((c) => c < 0 || c >= input.classes)) {
        problems.push({
          kind: "fixed",
          message: `${s.name}: ${t.name || "이름 없는 교사"}의 담당 반에 1~${input.classes}반 밖의 값이 있습니다.`,
        });
      }
      if (fixed.length * s.credits > Math.max(0, t.hours)) {
        problems.push({
          kind: "fixed",
          message: `${s.name}: ${t.name || "이름 없는 교사"}가 ${fixed.length}개 반(${fixed.length * s.credits}시간)을 맡는데 시수는 ${t.hours}시간입니다.`,
        });
      }
      fixed.forEach((c) => {
        const prev = owner.get(c);
        if (prev && prev !== t.name) {
          problems.push({ kind: "fixed", message: `${s.name}: ${c + 1}반을 ${prev}와 ${t.name} 두 분이 함께 지정했습니다.` });
        }
        owner.set(c, t.name);
      });
    });
  });

  // 이름이 같으면 같은 사람 — 한 사람이 구획 시수보다 많이 맡을 수는 없습니다.
  const perPerson = new Map<string, number>();
  input.subjects.forEach((s) =>
    s.teachers.forEach((t) => {
      const name = t.name.trim();
      if (!name) return;
      perPerson.set(name, (perPerson.get(name) ?? 0) + Math.max(0, t.hours));
    })
  );
  perPerson.forEach((totalHours, name) => {
    if (totalHours > hours) {
      problems.push({
        kind: "person",
        message: `${name} 선생님의 시수 합이 ${totalHours}시간으로 구획 시수 ${hours}시간을 넘습니다(한 타임에 한 반만 들어갈 수 있습니다).`,
      });
    }
  });

  return problems;
}

/** 배치 결과 한 칸 — 그 타임에 그 반이 듣는 과목과 들어가는 교사. */
export interface PlanCell {
  subject: string;
  teacher: string;
}

export interface PlanResult {
  /** grid[타임][반] */
  grid: PlanCell[][];
  /** 교사 이름 → 실제 배정된 시수 */
  load: Map<string, number>;
  /** 두 과목 이상을 맡는(겸임) 교사 이름 */
  multiSubject: string[];
}

interface Unit {
  cls: number;
  subject: string;
  teacher: string;
  hours: number;
}

/**
 * 1단계 — 반을 교사에게 나눠 줍니다.
 * 한 반의 한 과목은 되도록 한 교사가 통째로 맡게 하고(수업 연속성), 남는 시수만 쪼갭니다.
 */
function splitClasses(input: PlanInput): Unit[] {
  const units: Unit[] = [];
  input.subjects.forEach((s) => {
    if (s.credits <= 0) return;
    const left = s.teachers.map((t) => ({ name: t.name.trim() || "미정", left: Math.max(0, t.hours) }));

    // 손으로 지정한 담당 반이 먼저입니다 — 남은 반만 자동으로 나눕니다.
    const fixedOf = new Map<number, number>(); // 반 → 교사 index
    s.teachers.forEach((t, ti) => (t.classes ?? []).forEach((c) => fixedOf.set(c, ti)));
    fixedOf.forEach((ti, cls) => {
      const take = Math.min(s.credits, left[ti].left);
      if (take <= 0) return;
      units.push({ cls, subject: s.name, teacher: left[ti].name, hours: take });
      left[ti].left -= take;
    });

    for (let cls = 0; cls < input.classes; cls++) {
      if (fixedOf.has(cls)) continue;
      let need = s.credits;
      while (need > 0) {
        // 통째로 맡을 수 있는 교사 우선, 없으면 남은 시수가 가장 많은 교사.
        const whole = left.filter((t) => t.left >= need).sort((a, b) => b.left - a.left)[0];
        const pick = whole ?? left.filter((t) => t.left > 0).sort((a, b) => b.left - a.left)[0];
        if (!pick) return; // 시수가 모자람 — validatePlan 이 미리 걸러냅니다.
        const take = Math.min(need, pick.left);
        units.push({ cls, subject: s.name, teacher: pick.name, hours: take });
        pick.left -= take;
        need -= take;
      }
    }
  });
  return units;
}

/**
 * 2단계 — 타임마다 "반 ↔ 교사" 완전 매칭을 찾아 실제 시간표를 만듭니다.
 *
 * 각 반의 남은 시수 합 = 남은 타임 수이고 한 사람이 그 반에 가진 시수도 그 이하라,
 * 홀의 정리에 따라 매 타임 모든 반을 채우는 매칭이 존재합니다. 증가 경로(쿤 알고리즘)로
 * 찾고, 그래도 못 찾으면 null 을 돌려줍니다.
 */
export function buildPlan(input: PlanInput): PlanResult | null {
  const T = bandHours(input.subjects);
  if (T <= 0 || input.classes <= 0) return null;
  const units = splitClasses(input);
  if (!units.length) return null;

  // 반 → ("교사|과목" → 남은 시수). 같은 이름은 같은 사람이라 사람 키는 이름만 씁니다.
  const remain: Map<string, { subject: string; hours: number }>[] = Array.from(
    { length: input.classes },
    () => new Map()
  );
  units.forEach((u) => {
    const key = `${u.teacher}|${u.subject}`;
    const cur = remain[u.cls].get(key);
    remain[u.cls].set(key, { subject: u.subject, hours: (cur?.hours ?? 0) + u.hours });
  });

  const grid: PlanCell[][] = [];
  const load = new Map<string, number>();

  /** 반 cls 가 이번 타임에 person 에게 배울 수 있는 과목(남은 시수가 가장 많은 것). */
  const subjectFor = (cls: number, person: string): string | null => {
    let best: { subject: string; hours: number } | null = null;
    remain[cls].forEach((v, key) => {
      if (key.slice(0, key.lastIndexOf("|")) !== person || v.hours <= 0) return;
      if (!best || v.hours > best.hours) best = v;
    });
    return best ? (best as { subject: string; hours: number }).subject : null;
  };

  for (let t = 0; t < T; t++) {
    const left = T - t; // 남은 타임 수
    const classToPerson = new Map<number, string>();
    const personToClass = new Map<string, number>();

    const personsOf = (cls: number) =>
      [...new Set([...remain[cls].entries()].filter(([, v]) => v.hours > 0).map(([k]) => k.slice(0, k.lastIndexOf("|"))))];
    const classesOf = (person: string) =>
      [...Array(input.classes).keys()].filter((cls) => subjectFor(cls, person) !== null);

    // 증가 경로 — 반 쪽에서 출발
    const fromClass = (cls: number, seen: Set<string>): boolean => {
      for (const person of personsOf(cls)) {
        if (seen.has(person)) continue;
        seen.add(person);
        const holder = personToClass.get(person);
        if (holder === undefined || fromClass(holder, seen)) {
          personToClass.set(person, cls);
          classToPerson.set(cls, person);
          return true;
        }
      }
      return false;
    };
    // 증가 경로 — 교사 쪽에서 출발(반드시 이번 타임에 넣어야 하는 교사용)
    const fromPerson = (person: string, seen: Set<number>): boolean => {
      for (const cls of classesOf(person)) {
        if (seen.has(cls)) continue;
        seen.add(cls);
        const holder = classToPerson.get(cls);
        if (holder === undefined || fromPerson(holder, seen)) {
          classToPerson.set(cls, person);
          personToClass.set(person, cls);
          return true;
        }
      }
      return false;
    };

    // 남은 시수가 남은 타임 수와 같은 교사는 이번 타임에 반드시 들어가야 합니다.
    // (안 넣으면 마지막에 한 사람이 두 반을 동시에 맡아야 하는 상황이 생깁니다 — 실제로 겪음.)
    const personHours = new Map<string, number>();
    remain.forEach((m) =>
      m.forEach((v, key) => {
        const person = key.slice(0, key.lastIndexOf("|"));
        personHours.set(person, (personHours.get(person) ?? 0) + v.hours);
      })
    );
    const tight = [...personHours.entries()].filter(([, h]) => h >= left).map(([p]) => p);
    for (const person of tight) {
      if (personToClass.has(person)) continue;
      if (!fromPerson(person, new Set())) return null;
    }
    for (let cls = 0; cls < input.classes; cls++) {
      if (classToPerson.has(cls)) continue;
      if (!fromClass(cls, new Set())) return null;
    }

    const row: PlanCell[] = new Array(input.classes);
    for (let cls = 0; cls < input.classes; cls++) {
      const person = classToPerson.get(cls);
      const subject = person ? subjectFor(cls, person) : null;
      if (!person || !subject) return null;
      row[cls] = { subject, teacher: person };
      const key = `${person}|${subject}`;
      const v = remain[cls].get(key)!;
      v.hours -= 1;
      if (v.hours <= 0) remain[cls].delete(key);
      load.set(person, (load.get(person) ?? 0) + 1);
    }

    grid.push(row);
  }

  if (remain.some((m) => [...m.values()].some((v) => v.hours > 0))) return null;

  const subjectsOf = new Map<string, Set<string>>();
  input.subjects.forEach((s) =>
    s.teachers.forEach((t) => {
      const name = t.name.trim();
      if (!name || t.hours <= 0) return;
      if (!subjectsOf.has(name)) subjectsOf.set(name, new Set());
      subjectsOf.get(name)!.add(s.name);
    })
  );
  const multiSubject = [...subjectsOf.entries()].filter(([, set]) => set.size > 1).map(([name]) => name);

  return { grid, load, multiSubject };
}
