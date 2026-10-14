"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, Printer, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { BarChart, GROUP_COLORS, StrengthRadar, TrendChart, type TrendSeries } from "./Charts";
import { GradeChangeChart } from "./GradeChangeChart";
import { ClassOverview } from "./ClassOverview";
import { readNeisPdf } from "../lib/readNeis";
import type { CourseRecord, NeisStudent } from "../lib/neis";
import {
  comboSummary,
  comboTrend,
  estimateCourse,
  groupOf,
  groupSummary,
  improvementList,
  isGraded,
  simulate,
  termsOf,
  weightedAverage,
} from "../lib/naesin";

import { NotesPanel } from "./NotesPanel";
import type { Note, Notes } from "../lib/saveFile";

const f2 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));
const termName = (year: number, term: number) => `${year}학년 ${term}학기`;
const keyOf = (s: NeisStudent) => `${s.num}|${s.name}`;
const COLORS = ["#b45309", "#1d4ed8", "#047857", "#be185d"];

interface Props {
  /** 올린 학생 자료와 파일 표시 이름. 수시·정시 통합 화면과 함께 쓰므로 상위에서 들고 있습니다. */
  students: NeisStudent[];
  fileName: string;
  onChange: (students: NeisStudent[], fileName: string) => void;
  notes: Notes;
  onNote: (key: string, note: Note) => void;
  /** 선택한 학생(번호|이름). 세 탭이 함께 씁니다. */
  selected: string;
  onSelect: (key: string) => void;
}

export function NaesinView({ students, fileName, onChange, notes, onNote, selected, onSelect: setSelected }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trendMode, setTrendMode] = useState<"term" | "cum">("term");
  const [barMode, setBarMode] = useState<"group" | "subject">("group");
  const [yearFilter, setYearFilter] = useState<0 | 1 | 2 | 3>(0);
  const [termFilter, setTermFilter] = useState<0 | 1 | 2>(0);
  const [posTerm, setPosTerm] = useState("");
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [endPoint, setEndPoint] = useState<"susi" | "jeongsi">("jeongsi");
  const [credits, setCredits] = useState("");
  const [target, setTarget] = useState("1.00");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeKey = students.some((s) => keyOf(s) === selected) ? selected : students[0] ? keyOf(students[0]) : "";
  const student = students.find((s) => keyOf(s) === activeKey);
  const courses = useMemo(() => student?.courses ?? [], [student]);

  async function load(file: File | undefined) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setError("PDF 파일만 올릴 수 있습니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await readNeisPdf(file);
      if (!res.students.length) {
        setError("교과학습발달상황 표를 찾지 못했습니다. NEIS에서 출력한 '학교생활기록부 교과학습발달상황' PDF가 맞는지 확인해 주세요.");
      } else {
        onChange(res.students, `${file.name} · 학생 ${res.students.length}명`);
        setSelected("");
      }
    } catch (e) {
      setError(`파일을 읽는 중 문제가 생겼습니다. (${e instanceof Error ? e.message : "알 수 없는 오류"})`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const terms = useMemo(() => termsOf(courses), [courses]);
  const overall = useMemo(() => weightedAverage(courses), [courses]);
  const combos = useMemo(() => comboSummary(courses), [courses]);
  const trend = useMemo(() => comboTrend(courses), [courses]);
  const groups = useMemo(() => groupSummary(courses), [courses]);
  const improve = useMemo(() => improvementList(courses), [courses]);

  const graded = courses.filter(isGraded);
  const subjectsDistinct = new Set(graded.map((c) => c.subject)).size;
  const gradeNums = graded.map((c) => c.rankGrade as number);
  const best = gradeNums.length ? Math.min(...gradeNums) : null;
  const worst = gradeNums.length ? Math.max(...gradeNums) : null;

  // 과목별 성적표: 처음 나온 순서
  const subjectRows = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Map<string, CourseRecord>>();
    for (const c of [...courses].sort((a, b) => a.year - b.year || a.term - b.term)) {
      if (!map.has(c.subject)) {
        map.set(c.subject, new Map());
        order.push(c.subject);
      }
      map.get(c.subject)!.set(`${c.year}-${c.term}`, c);
    }
    return order.map((s) => ({ subject: s, cells: map.get(s)! }));
  }, [courses]);

  // 목표 시뮬레이션: 남은 학기
  const last = terms[terms.length - 1];
  const endTerm = endPoint === "susi" ? 31 : 32;
  const remainingTerms = last
    ? [31, 32].filter((t) => t > last.year * 10 + last.term && t <= endTerm)
    : [];
  const perTermCredits = terms.length ? Math.round(overall.credits / terms.length) : 0;
  const remCredits = credits.trim() !== "" ? Math.max(0, Number(credits) || 0) : remainingTerms.length * perTermCredits;
  const sim = useMemo(() => simulate(courses, remCredits), [courses, remCredits]);
  const targetNum = Number(target);

  const trendSeries: TrendSeries[] = trend.map((t, i) => ({
    label: t.label,
    color: COLORS[i % COLORS.length],
    dashed: i > 0,
    values: trendMode === "term" ? t.perTerm : t.cumulative,
  }));
  const allTrend = trendSeries.flatMap((s) => s.values).filter((v): v is number => v != null);
  const tMin = allTrend.length ? Math.min(...allTrend) : 1;
  const tMax = allTrend.length ? Math.max(...allTrend) : 2;
  const lo = Math.max(1, Math.floor((tMin - 0.1) * 10) / 10);
  const range: [number, number] = [lo, Math.max(Math.min(9, Math.ceil((tMax + 0.1) * 10) / 10), lo + 0.4)];

  // 방사형: 과목군별(교과군) 또는 과목별 학점 가중 평균. 기준선은 학생 전체 평균입니다.
  const radarItems: { label: string; grade: number }[] =
    barMode === "group"
      ? groups.filter((g) => g.avg != null).map((g) => ({ label: g.group, grade: g.avg as number }))
      : subjectRows
          .map((r) => ({ label: r.subject, grade: weightedAverage([...r.cells.values()].filter(isGraded)).avg }))
          .filter((it): it is { label: string; grade: number } => it.grade != null);
  const refAvg = overall.avg;
  const diffOf = (g: number) => (refAvg == null ? 0 : Math.round((g - refAvg) * 100) / 100);
  const strongList = radarItems.filter((i) => refAvg != null && diffOf(i.grade) <= -0.3).sort((a, b) => a.grade - b.grade);
  const weakList = radarItems.filter((i) => refAvg != null && diffOf(i.grade) >= 0.3).sort((a, b) => b.grade - a.grade);
  // 원점수 위치: 고른 학기의 석차등급 과목(원점수·평균·표준편차가 있는 것)
  const posActive = terms.some((t) => t.key === posTerm) ? posTerm : (terms[0]?.key ?? "");
  const posRows = courses
    .filter((c) => `${c.year}-${c.term}` === posActive && isGraded(c) && c.raw != null && c.avg != null && c.sd != null)
    .map((c) => ({ course: c, dev: (c.sd as number) > 0 ? ((c.raw as number) - (c.avg as number)) / (c.sd as number) : 0 }));
  const improveShown = improve.filter(
    (x) => (yearFilter === 0 || x.course.year === yearFilter) && (termFilter === 0 || x.course.term === termFilter),
  );
  const groupName = (g: string) => (g === "제2외국어" || g === "예체능·기타" ? g : `${g}계열`);
  const barItems =
    barMode === "group"
      ? groups.filter((g) => g.avg != null).map((g) => ({ label: groupName(g.group), value: g.avg as number, color: GROUP_COLORS[g.group] }))
      : subjectRows
          .map((r) => {
            const list = [...r.cells.values()].filter(isGraded);
            return { label: r.subject, value: weightedAverage(list).avg, color: GROUP_COLORS[groupOf(r.subject)] };
          })
          .filter((it): it is { label: string; value: number; color: string } => it.value != null);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-3 grid gap-3 lg:grid-cols-[320px_1fr] items-start">
      <aside className="print:hidden grid gap-3 sm:grid-cols-2 lg:grid-cols-1 items-start">
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="font-bold mb-2">1. 교과학습발달상황 올리기</h2>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void load(e.dataTransfer.files[0]);
            }}
            className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-6 text-center cursor-pointer hover:bg-amber-100"
          >
            <Upload className="w-6 h-6 text-amber-700" />
            <span className="text-sm font-bold">{busy ? "읽는 중…" : "PDF를 끌어다 놓거나 눌러서 고르세요"}</span>
            <span className="text-xs text-stone-600">NEIS 학교생활기록부 &lsquo;교과학습발달상황&rsquo; 일람표 PDF (학기말까지 입력된 것)</span>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void load(e.target.files?.[0])} />
          </label>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
            파일은 이 컴퓨터(브라우저) 안에서만 읽습니다. 서버로 보내거나 저장하지 않습니다.
          </p>
          {error && <p className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {fileName && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs">
              <FileText className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
              <span className="flex-1 min-w-0 break-all">{fileName}</span>
              <button
                aria-label="파일 지우기"
                onClick={() => onChange([], "")}
                className="p-0.5 text-stone-500 hover:text-stone-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-700 space-y-1.5">
          <h2 className="font-bold text-sm">읽는 기준</h2>
          <p>석차등급(1~9)이 있는 과목만 평균에 넣습니다. 이수(P)·성취도만 있는 과목은 빠집니다.</p>
          <p>평균등급은 등급 × 학점의 합 ÷ 학점의 합(학점 가중)입니다.</p>
          <p>소수 등급(1.64 등)과 &lsquo;앞에 약 N명&rsquo;은 원점수·과목평균·표준편차로 추정한 값이라 실제 석차와 다를 수 있습니다.</p>
        </section>
      </aside>

      <main className="space-y-3 min-w-0">
        {!student ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-lg font-bold">왼쪽에서 교과학습발달상황 PDF를 올려 주세요</p>
            <p className="mt-2 text-sm text-stone-600">한 PDF에 학급 전체가 들어 있어도 됩니다. 학생을 골라 평균등급, 학기별 추이, 강점·약점, 목표 계산을 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            {/* 스크롤해도 화면 위에 붙어 있어 어디서든 학생을 바꿀 수 있습니다 */}
            <div className="print:hidden sticky top-0 z-20 flex items-center gap-2 flex-wrap rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
              <label htmlFor="nstu" className="text-sm font-bold">
                학생
              </label>
              <select
                id="nstu"
                value={activeKey}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm bg-white"
              >
                {students.map((s) => (
                  <option key={keyOf(s)} value={keyOf(s)}>
                    {s.classNo ? `${s.classNo}반 ` : ""}
                    {s.num}번 {s.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-stone-600">{students.length}명</span>
              <button
                onClick={() => window.print()}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50"
              >
                <Printer className="w-4 h-4" /> 인쇄 · PDF 저장
              </button>
              <button
                onClick={() => {
                  onChange([], "");
                  setError("");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50"
              >
                <RotateCcw className="w-4 h-4" /> 초기화
              </button>
            </div>

            <NotesPanel pkey={activeKey} name={student.name} notes={notes} onChange={onNote} />

            {/* 1. 요약 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold">
                {student.name} · 내신 성적 요약{" "}
                <span className="ml-1 text-xs font-normal text-stone-600">
                  {student.level ? `${student.level}학년 ` : ""}
                  {student.classNo ? `${student.classNo}반 ` : ""}
                  {student.num}번 · {terms.length ? `${termName(terms[0].year, terms[0].term)} ~ ${termName(last.year, last.term)}` : ""}
                </span>
              </h2>
              <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
                <Card title="이수 과목" value={`${subjectsDistinct}개`} sub={`석차등급 과목 ${graded.length}건 · ${overall.credits}학점`} />
                <Card title="평균등급 (학점 가중)" value={f2(overall.avg)} unit="등급" sub="전과목 기준" />
                <Card title="최고 / 최저 등급" value={best == null ? "—" : `${best} / ${worst}`} unit="등급" />
                <Card title="반영 학기" value={`${terms.length}개`} sub={terms.map((t) => `${t.year}-${t.term}`).join(", ")} />
              </div>
              <div className="mt-5 border-t border-stone-200 pt-4">
              <h3 className="font-bold">반영 조합별 평균</h3>
              <p className="text-xs text-stone-600 mb-3">대학이 많이 보는 조합으로 묶은 학점 가중 평균입니다. (등급 × 학점의 합 ÷ 학점 합, 대학 산출 방식)</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
                {combos.map((c) => (
                  <Card key={c.key} title={c.label} value={f2(c.avg)} unit="등급" sub={`${c.credits}학점 · ${c.count}과목`} />
                ))}
              </div>
              <p className="mt-2 text-xs text-stone-600">사회 조합에는 한국사·통합사회 등이, 과학 조합에는 통합과학·물리학·화학·생명과학 등이 들어갑니다. 과학탐구실험처럼 석차등급이 없는 과목은 빠집니다.</p>
              </div>
            </section>

            {/* 4. 추이 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="font-bold">반영 조합별 평균 추이</h2>
                <div className="print:hidden ml-auto inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm">
                  {(
                    [
                      ["term", "학기별 평균"],
                      ["cum", "그 학기까지 누적"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setTrendMode(k)}
                      className={`px-3 py-1 ${trendMode === k ? "bg-amber-600 text-white" : "bg-white hover:bg-stone-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-stone-600 mb-2">
                {trendMode === "term"
                  ? "학기별은 그 학기 과목만의 평균입니다. 오르내림을 보기에 좋습니다."
                  : "누적은 그 학기까지 모든 과목의 평균입니다. 대학이 실제로 보는 값에 가깝습니다."}{" "}
                위로 갈수록 좋은 등급이고, 세로축은 차이가 보이도록 이 학생 범위로 확대했습니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[480px] mb-3">
                  <thead>
                    <tr className="bg-stone-100">
                      <th className="p-2 border border-stone-200 text-left">조합</th>
                      {terms.map((t) => (
                        <th key={t.key} className="p-2 border border-stone-200 text-center">
                          {t.year}-{t.term}
                        </th>
                      ))}
                      <th className="p-2 border border-stone-200 text-center">첫 학기 대비</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((t) => {
                      const vals = trendMode === "term" ? t.perTerm : t.cumulative;
                      const first = vals.find((v) => v != null) ?? null;
                      const lastV = [...vals].reverse().find((v) => v != null) ?? null;
                      const d = first != null && lastV != null ? Math.round((first - lastV) * 100) / 100 : null;
                      return (
                        <tr key={t.key}>
                          <th className="p-2 border border-stone-200 bg-stone-50 text-left font-medium">{t.label}</th>
                          {vals.map((v, i) => (
                            <td key={i} className="p-2 border border-stone-200 text-center">
                              {f2(v)}
                            </td>
                          ))}
                          <td className="p-2 border border-stone-200 text-center">
                            {d == null || d === 0 ? (
                              "변화 없음"
                            ) : d > 0 ? (
                              <b className="text-emerald-700">▲ {d.toFixed(2)} 좋아짐</b>
                            ) : (
                              <b className="text-rose-700">▼ {(-d).toFixed(2)} 나빠짐</b>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TrendChart labels={terms.map((t) => `${t.year}-${t.term}`)} series={trendSeries} range={range} />
            </section>

            <GradeChangeChart courses={courses} />

            {/* 3. 과목별 성적 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4 overflow-x-auto">
              {/* 처음엔 접혀 있고, 누르면 펼칩니다. 인쇄할 때는 표가 빠지지 않도록 자동으로 펼쳐서 나옵니다. */}
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-bold">과목별 성적</h2>
                <span className="text-xs text-stone-500">
                  {subjectRows.length}과목 · {terms.length}개 학기
                </span>
                <button
                  type="button"
                  onClick={() => setSubjectsOpen((o) => !o)}
                  aria-expanded={subjectsOpen}
                  aria-controls="subject-grades-table"
                  className="print:hidden ml-auto inline-flex items-center gap-1.5 rounded-full border-2 border-stone-300 bg-white px-4 py-1.5 text-sm font-bold text-stone-800 hover:bg-stone-50"
                >
                  {subjectsOpen ? "접기" : "펼쳐 보기"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${subjectsOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              <div id="subject-grades-table" className={subjectsOpen ? "mt-1" : "hidden print:block"}>
              <p className="text-xs text-stone-600 mb-2">
                소수점은 그 등급 안에서의 위치입니다. 5.81등급이면 5등급 중에서도 아래쪽이라는 뜻이지, 6등급에 가까워졌다는 뜻이 아닙니다.
              </p>
              <table className="w-full text-sm border-collapse" style={{ minWidth: 120 + terms.length * 130 }}>
                <thead>
                  <tr className="bg-stone-100">
                    <th className="p-2 border border-stone-200 text-left w-32">과목</th>
                    {terms.map((t) => (
                      <th key={t.key} className="p-2 border border-stone-200 text-center">
                        {termName(t.year, t.term)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((row) => (
                    <tr key={row.subject}>
                      <th className="p-2 border border-stone-200 bg-stone-50 text-left font-medium">{row.subject}</th>
                      {terms.map((t) => {
                        const c = row.cells.get(t.key);
                        return (
                          <td key={t.key} className="p-1.5 border border-stone-200 text-center align-top">
                            {c ? <CourseCell c={c} /> : <span className="text-stone-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>

            {/* 5. 강점·약점 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold">강점 · 약점 (교과군별 등급)</h2>
              <p className="text-xs text-stone-600 mb-3">
                바깥쪽일수록 좋은 등급 · 학점 가중 평균입니다. 이 학생 전체 평균 {f2(overall.avg)}등급보다 0.3등급 이상 좋으면 강점, 나쁘면 약점입니다.
              </p>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
                <div className="rounded-2xl border border-stone-200 bg-[#fbf7f1] p-4">
                  <h3 className="font-bold">강점 · 약점 방사형</h3>
                  <p className="mt-1 text-xs text-stone-600">바깥쪽일수록 좋은 등급 · 학점 가중 평균 · 초록 점은 강점, 빨간 점은 약점</p>
                  <div className="print:hidden mt-3 flex gap-2">
                    {(
                      [
                        ["group", "과목군별"],
                        ["subject", "과목별"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setBarMode(k)}
                        aria-pressed={barMode === k}
                        className={`rounded-full px-5 py-2 text-sm font-bold ${
                          barMode === k ? "bg-[#1e5a8c] text-white shadow-md" : "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <StrengthRadar axes={radarItems} reference={refAvg} />
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p>
                      <b className="inline-block w-12 text-emerald-800">강점</b>
                      {strongList.length ? strongList.map((i) => `${i.label} ${i.grade.toFixed(2)}`).join(" · ") : "없음"}
                    </p>
                    <p>
                      <b className="inline-block w-12 text-rose-800">약점</b>
                      {weakList.length ? weakList.map((i) => `${i.label} ${i.grade.toFixed(2)}`).join(" · ") : "없음"}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    점선은 이 학생 전체 평균 <b className="text-stone-700">{f2(refAvg)}</b>입니다. 평균보다 0.3등급 이상 좋으면 강점, 나쁘면 약점입니다.
                  </p>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-stone-100 text-left">
                      <th className="p-2 border border-stone-200">교과군</th>
                      <th className="p-2 border border-stone-200 text-center">평균등급</th>
                      <th className="p-2 border border-stone-200 text-center">학점·과목</th>
                      <th className="p-2 border border-stone-200 text-center">구분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.group}>
                        <td className="p-2 border border-stone-200 font-medium">{g.group}</td>
                        <td className="p-2 border border-stone-200 text-center">{f2(g.avg)}</td>
                        <td className="p-2 border border-stone-200 text-center">
                          {g.credits}학점 · {g.count}과목
                        </td>
                        <td className="p-2 border border-stone-200 text-center">
                          {g.tag === "강점" ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 font-bold">강점</span>
                          ) : g.tag === "약점" ? (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800 font-bold">약점</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="font-bold text-sm">{barMode === "group" ? "과목군별 등급" : "과목별 등급"}</h3>
                  <div className="print:hidden ml-auto inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm">
                    {(
                      [
                        ["group", "과목군별"],
                        ["subject", "과목별"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setBarMode(k)}
                        className={`px-3 py-1 ${barMode === k ? "bg-amber-600 text-white" : "bg-white hover:bg-stone-50"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-stone-600 mb-2">막대가 높을수록 좋은 등급 · 학점이 많고 여러 학기 이수한 과목일수록 비중이 큽니다</p>
                <BarChart items={barItems} />
              </div>
            </section>

            {/* 6. 한 등급만 올리면 되는 과목 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold">한 등급만 올리면 되는 과목</h2>
              <p className="text-xs text-stone-600 mb-3">
                앞에 있는 학생이 적은 과목부터 보여 줍니다(같으면 여유 점수가 큰 과목부터). 학기마다 따로 보여 줍니다. 막대는 지금 등급에 든 학생 중 내 위치이고,{" "}
                <b>오른쪽 끝이 한 등급 위 커트라인</b>입니다. 꽉 찰수록 가깝습니다. 점수가 &lsquo;여유&rsquo;라고 나오면, 점수 분포로는 이미 커트라인을 넘겼는데 학교 기록 등급은 아직 한 등급 아래라는 뜻입니다.
              </p>
              <div className="print:hidden mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-stone-700">학기</span>
                {(
                  [
                    [0, "전체"],
                    [1, "1학기"],
                    [2, "2학기"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTermFilter(k)}
                    aria-pressed={termFilter === k}
                    className={`px-4 py-1.5 rounded-full border-2 text-sm font-bold ${
                      termFilter === k ? "bg-sky-800 border-sky-800 text-white" : "bg-white border-sky-700 text-sky-800 hover:bg-sky-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-3 text-sm text-stone-700">학년</span>
                {(
                  [
                    [0, "전체"],
                    [1, "1학년"],
                    [2, "2학년"],
                    [3, "3학년"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setYearFilter(k)}
                    aria-pressed={yearFilter === k}
                    className={`px-4 py-1.5 rounded-full border-2 text-sm font-bold ${
                      yearFilter === k ? "bg-emerald-800 border-emerald-800 text-white" : "bg-white border-emerald-700 text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {improveShown.length === 0 ? (
                <p className="text-sm text-stone-600">
                  {improve.length === 0
                    ? "1등급이 아닌 과목이 없거나, 추정에 필요한 원점수·평균·표준편차 자료가 없습니다."
                    : `${yearFilter === 0 ? "" : `${yearFilter}학년 `}${termFilter === 0 ? "" : `${termFilter}학기 `}조건에 맞는 올릴 수 있는 과목이 없습니다.`}
                </p>
              ) : (
                <ol className="grid gap-3 md:grid-cols-2">
                  {improveShown.slice(0, 12).map(({ course: c, est }, i) => {
                    const g = c.rankGrade as number;
                    const badge = g >= 7 ? "bg-rose-100 text-rose-800" : g >= 4 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
                    return (
                      <li key={`${c.year}-${c.term}-${c.subject}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <b className={i === 0 ? "text-sky-700 text-lg" : "text-stone-500 text-lg"}>{i + 1}위</b>
                          <b>{c.subject}</b>
                          <span className="text-xs text-stone-600">{termName(c.year, c.term)}</span>
                          <span className={`ml-auto rounded-md px-2 py-0.5 text-sm font-bold ${badge}`}>{g}등급</span>
                          <span className="text-sm font-bold text-emerald-800">→ {g - 1}등급 목표</span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                          <div className="h-2.5 w-44 max-w-full rounded-full bg-stone-200 overflow-hidden" aria-hidden>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-green-500"
                              style={{ width: `${Math.max(3, Math.round((1 - est.position) * 100))}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-emerald-900">
                            같은 등급 {est.sameGrade}명 중 앞 약 {est.ahead}명 ·{" "}
                            {(est.needScore as number) < 0 ? `여유 ${Math.abs(est.needScore as number)}점` : `${est.needScore}점 필요`}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-stone-600">
                          내 점수 {c.raw}점 / 평균 {c.avg}점 / 표준편차 {c.sd}점 · 9등급제
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-violet-700">
                          앞에 약 {est.ahead}명 추월 필요 (추정 {est.estRank}위/{c.takers}명 → {est.cutRank}위 이내) ※ 원점수·분포 기반 추정
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* 7. 원점수 위치 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold">원점수 위치</h2>
              <p className="text-xs text-stone-600 mb-3">
                같은 등급이어도 과목 안에서의 자리는 다릅니다. 점이 과목평균 선(세로 막대)보다 오른쪽에 멀리 있을수록 수강자 중 앞쪽입니다.
              </p>
              <div className="print:hidden mb-4 flex flex-wrap gap-2">
                {terms.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setPosTerm(t.key)}
                    aria-pressed={posActive === t.key}
                    className={`min-w-[4.5rem] rounded-full px-5 py-2 text-base font-bold ${
                      posActive === t.key ? "bg-[#1e5a8c] text-white shadow-md" : "bg-white text-stone-800 border-2 border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {t.year}-{t.term}
                  </button>
                ))}
              </div>
              {posRows.length === 0 ? (
                <p className="text-sm text-stone-600">이 학기에는 원점수·평균·표준편차가 있는 석차등급 과목이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    <div className="grid grid-cols-[150px_1fr_230px] gap-x-3">
                      <span />
                      <div className="relative h-5 text-xs text-stone-500" aria-hidden>
                        {[0, 25, 50, 75, 100].map((v) => (
                          <span
                            key={v}
                            className="absolute whitespace-nowrap"
                            style={{ left: `${v}%`, transform: v === 0 ? "none" : v === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
                          >
                            {v}
                            {v === 100 ? "점" : ""}
                          </span>
                        ))}
                      </div>
                      <span />
                    </div>
                    {posRows.map(({ course: c, dev }) => {
                      const g = c.rankGrade as number;
                      const badge =
                        g <= 2
                          ? "bg-emerald-100 text-emerald-800"
                          : g <= 4
                            ? "bg-yellow-100 text-yellow-800"
                            : g === 5
                              ? "bg-orange-100 text-orange-800"
                              : g <= 7
                                ? "bg-rose-100 text-rose-800"
                                : "bg-red-200 text-red-900";
                      const dot = dev >= 1 ? "#3f6f4a" : dev <= -1 ? "#9f2a40" : "#1e5a8c";
                      const avg = c.avg as number;
                      const sd = c.sd as number;
                      const raw = c.raw as number;
                      const bandL = Math.max(0, avg - sd);
                      const bandR = Math.min(100, avg + sd);
                      return (
                        <div key={c.subject} className="grid grid-cols-[150px_1fr_230px] gap-x-3 items-center border-t border-stone-200 py-2.5">
                          <p className="flex items-center gap-2 font-bold text-stone-900">
                            <span>{c.subject}</span>
                            <span className={`rounded-lg px-2 py-0.5 text-sm font-bold ${badge}`}>{g}</span>
                          </p>
                          <div className="relative h-8 rounded-full bg-[#f3ece1]">
                            <div
                              className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full border border-blue-200 bg-blue-50"
                              style={{ left: `${bandL}%`, width: `${bandR - bandL}%` }}
                            />
                            <div className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-stone-500" style={{ left: `${avg}%` }} />
                            <div
                              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-2 ring-stone-400"
                              style={{ left: `${Math.min(100, Math.max(0, raw))}%`, background: dot }}
                            />
                          </div>
                          <div className="text-sm leading-tight">
                            <p>
                              <b className="text-lg text-stone-900">{raw}</b> <span className="text-stone-500">/ {avg}</span>
                            </p>
                            <p className="text-xs text-stone-600">
                              평균보다 표준편차의{" "}
                              <b className={dev <= -1 ? "text-rose-700" : dev >= 1 ? "text-emerald-700" : "text-stone-800"}>{Math.abs(dev).toFixed(1)}배</b>{" "}
                              {dev >= 0 ? "위" : "아래"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-200 pt-3 text-xs text-stone-700">
                      <b>내 원점수</b>
                      {(
                        [
                          ["#3f6f4a", "평균보다 표준편차 1배 이상 위"],
                          ["#1e5a8c", "평균 근처"],
                          ["#9f2a40", "평균보다 표준편차 1배 이상 아래"],
                        ] as const
                      ).map(([color, label]) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-white ring-2 ring-stone-400" style={{ background: color }} />
                          {label}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-4 w-1 rounded bg-stone-500" /> 과목평균
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3 w-8 rounded-full border border-blue-200 bg-blue-50" /> 평균 ± 표준편차 (수강자 약 68%가 이 안)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 8. 목표 시뮬레이션 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold">목표 시뮬레이션</h2>
              <p className="text-xs text-stone-600 mb-3">남은 학기에 이 정도 받으면 최종 평균이 어떻게 되는지, 목표 평균에 필요한 등급은 몇인지 계산합니다.</p>
              <div className="print:hidden inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm mb-3">
                {(
                  [
                    ["susi", "3학년 1학기까지 (수시)"],
                    ["jeongsi", "3학년 2학기까지 (정시)"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setEndPoint(k)}
                    className={`px-3 py-1.5 ${endPoint === k ? "bg-amber-600 text-white" : "bg-white hover:bg-stone-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {remainingTerms.length === 0 && credits.trim() === "" ? (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                  {endPoint === "susi"
                    ? "3학년 1학기까지 성적이 이미 있어 수시 반영 학기가 끝났습니다. 「3학년 2학기까지(정시)」를 눌러 보세요."
                    : "선택한 시점까지의 성적이 이미 모두 있습니다. 남은 학점을 직접 넣어 계산해 볼 수도 있습니다."}
                </p>
              ) : null}
              <div className="mt-2 grid gap-3 sm:grid-cols-2 max-w-xl">
                <label className="text-sm">
                  남은 학점{" "}
                  <span className="text-xs text-stone-500">
                    (비워 두면 남은 {remainingTerms.length}학기 × 학기당 약 {perTermCredits}학점)
                  </span>
                  <input
                    inputMode="numeric"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder={String(remainingTerms.length * perTermCredits)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="text-sm">
                  목표 평균등급
                  <input
                    inputMode="decimal"
                    value={target}
                    onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5"
                  />
                </label>
              </div>
              {remCredits > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-1">남은 학기를 이 등급으로 받으면</p>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-stone-100">
                          <th className="p-2 border border-stone-200">남은 학기 평균등급</th>
                          <th className="p-2 border border-stone-200">최종 평균</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sim.rows.map((r) => (
                          <tr key={r.grade}>
                            <td className="p-2 border border-stone-200 text-center">{r.grade.toFixed(1)}등급</td>
                            <td className="p-2 border border-stone-200 text-center font-bold text-amber-800">{r.final.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
                    <p className="font-medium">목표 {Number.isFinite(targetNum) ? targetNum.toFixed(2) : "—"}등급을 만들려면</p>
                    {Number.isFinite(targetNum) && targetNum > 0 ? (
                      (() => {
                        const need = sim.needFor(targetNum);
                        if (need == null) return <p className="mt-1">남은 학점을 입력해 주세요.</p>;
                        if (need < 1)
                          return (
                            <p className="mt-1 text-rose-800">
                              남은 학기를 모두 1등급으로 받아도 {sim.rows[0].final.toFixed(2)}까지만 가능합니다.
                            </p>
                          );
                        if (need > 9) return <p className="mt-1 text-emerald-800">남은 학기를 9등급으로 받아도 이미 목표 이내입니다.</p>;
                        return (
                          <p className="mt-1">
                            남은 {remCredits}학점의 평균등급이 <b className="text-amber-800">{need.toFixed(2)}등급 이내</b>여야 합니다.
                          </p>
                        );
                      })()
                    ) : (
                      <p className="mt-1">목표 평균등급을 입력해 주세요.</p>
                    )}
                    <p className="mt-2 text-xs text-stone-600">
                      지금까지 {sim.baseCredits}학점 평균 {f2(sim.baseAvg)}등급 기준입니다.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* 9. 학급 한눈에 보기 — 교사용, 인쇄하지 않음 */}
            <ClassOverview students={students} selectedKey={activeKey} onSelect={setSelected} />
          </>
        )}
      </main>
    </div>
  );
}

function Card({ title, value, unit, sub }: { title: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 min-w-0">
      <p className="text-xs text-stone-600">{title}</p>
      <p className="text-2xl font-bold text-amber-800">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-stone-600">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-stone-600 truncate">{sub}</p>}
    </div>
  );
}

function CourseCell({ c }: { c: CourseRecord }) {
  if (!isGraded(c)) {
    return (
      <div className="text-xs text-stone-600">
        <b className="block text-sm text-stone-700">{c.passFail ? "이수(P)" : (c.achievement ?? "—")}</b>
        {c.raw != null && <span>원점수 {c.raw}점</span>}
        {c.credit != null && <span className="block">{c.credit}학점</span>}
      </div>
    );
  }
  const e = estimateCourse(c);
  return (
    <div className="text-xs text-stone-600 leading-snug">
      <b className="block text-base text-amber-800">
        {(e?.fractional ?? c.rankGrade)?.toFixed(2)}
        <span className="text-xs font-medium">등급</span>
      </b>
      {c.takers != null && <span className="block">{c.takers}명 수강</span>}
      {c.raw != null && <span className="block">원점수 {c.raw}점</span>}
      {e && e.ahead != null && e.ahead > 0 && <span className="block text-rose-700">앞에 약 {e.ahead}명</span>}
    </div>
  );
}
