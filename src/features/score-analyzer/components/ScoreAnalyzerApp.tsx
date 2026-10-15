"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, FolderOpen, Printer, RotateCcw, Save, ShieldCheck, Upload, X } from "lucide-react";
import { RadarChart, TrendChart, type TrendSeries } from "./Charts";
import { NaesinView } from "./NaesinView";
import { IntegratedView } from "./IntegratedView";
import { GuideLink } from "@/features/guide/components/GuideLink";
import { NotesPanel } from "./NotesPanel";
import { AdmissionView } from "./AdmissionView";
import { EMPTY_ADMISSION, packAdmission, unpackAdmission, type AdmissionState } from "../lib/admission";
import type { Guideline } from "../lib/guideline";
import { decodeSave, encodeSave, isEncrypted, personKey, type Note, type Notes } from "../lib/saveFile";
import type { NeisStudent } from "../lib/neis";
import { readReportPdf } from "../lib/readPdf";
import {
  DEFAULT_OPTIONS,
  areaOf,
  csatMin,
  extremes,
  gradeOf,
  meanGrade,
  percentileMean,
  trendOf,
  type Options,
} from "../lib/analyze";
import { AREA_ORDER, examLabel, studentKey, type AreaKey, type Report } from "../lib/types";

interface LoadedFile {
  name: string;
  students: number;
  skipped: number;
  exam: string;
}

const LINE_COLORS: Record<AreaKey, string> = {
  국어: "#b45309",
  수학: "#1d4ed8",
  영어: "#047857",
  한국사: "#6b7280",
  탐구1: "#be185d",
  탐구2: "#7c3aed",
};

const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d).replace(/\.?0+$/, "") || "0");
const byExam = (a: Report, b: Report) => a.year - b.year || a.month - b.month;

export function ScoreAnalyzerApp({ initialReports = [] }: { initialReports?: Report[] }) {
  const [tab, setTab] = useState<"naesin" | "mock" | "integrated" | "admission">("naesin");
  // 입결 자료(대학어디가). 줄인 형태로 저장 파일에 함께 담깁니다.
  const [admission, setAdmission] = useState<AdmissionState>(EMPTY_ADMISSION);
  // 모집요강 정리 JSON(대학별 반영 규칙). 저장 파일에 함께 담깁니다.
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  // 내신 자료는 내신 탭과 수시·정시 통합 탭이 함께 쓰므로 여기서 들고 있습니다.
  const [naesin, setNaesin] = useState<{ students: NeisStudent[]; fileName: string }>({ students: [], fileName: "" });
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [selected, setSelected] = useState("");
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [inquiryMode, setInquiryMode] = useState<"best" | "avg">("best");
  const [radarExam, setRadarExam] = useState("");
  const [minExam, setMinExam] = useState("");
  const [diagExam, setDiagExam] = useState("");
  const [notes, setNotes] = useState<Notes>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const loadRef = useRef<HTMLInputElement>(null);
  const setNote = (k: string, n: Note) => setNotes((p) => ({ ...p, [k]: n }));

  const students = useMemo(() => {
    const m = new Map<string, Report>();
    for (const r of reports) m.set(studentKey(r), r);
    return [...m.entries()]
      .map(([key, r]) => ({ key, pkey: personKey(r.num, r.name), label: `${r.classNo}반 ${r.num}번 ${r.name}`, classNo: r.classNo, num: r.num }))
      .sort((a, b) => a.classNo - b.classNo || a.num - b.num);
  }, [reports]);

  // 선택한 학생(번호|이름)은 세 탭이 함께 씁니다. 이 탭 자료에 없으면 첫 학생을 보여 줍니다.
  const activeKey = (students.find((s) => s.pkey === selected) ?? students[0])?.key ?? "";
  const mine = useMemo(() => reports.filter((r) => studentKey(r) === activeKey).sort(byExam), [reports, activeKey]);
  const latest = mine[mine.length - 1];
  const exams = useMemo(() => [...new Set(reports.map((r) => r.examKey))], [reports]);

  async function addFiles(list: FileList | File[]) {
    const pdfs = [...list].filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setError("PDF 파일만 올릴 수 있습니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const added: Report[] = [];
      const notes: LoadedFile[] = [];
      for (const f of pdfs) {
        const res = await readReportPdf(f);
        if (!res.reports.length) {
          setError(`"${f.name}"에서 성적통지표를 찾지 못했습니다. 전국연합학력평가 또는 평가원 모의평가(6월·9월) 성적통지표 PDF가 맞는지 확인해 주세요.`);
          continue;
        }
        added.push(...res.reports);
        notes.push({ name: f.name, students: res.reports.length, skipped: res.skipped, exam: examLabel(res.reports[0]) });
      }
      if (added.length) {
        setReports((prev) => {
          const m = new Map(prev.map((r) => [`${r.examKey}|${studentKey(r)}`, r]));
          for (const r of added) m.set(`${r.examKey}|${studentKey(r)}`, r); // 같은 회차를 다시 올리면 새 것으로 바꿉니다
          return [...m.values()];
        });
        setFiles((prev) => [...prev, ...notes]);
      }
    } catch (e) {
      setError(`파일을 읽는 중 문제가 생겼습니다. (${e instanceof Error ? e.message : "알 수 없는 오류"})`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function reset() {
    setReports([]);
    setFiles([]);
    setSelected("");
    setOpts(DEFAULT_OPTIONS);
    setNotes({});
    setError("");
  }

  async function saveToFile() {
    const suggested = `성적분석기-저장-${new Date().toISOString().slice(0, 10)}.json`;
    // 저장 위치·파일 이름을 직접 고르는 창(크롬·엣지). 지원하지 않는 브라우저는 이름만 물어 다운로드 폴더에 저장합니다.
    type Picker = (o: object) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
    const picker = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;
    let handle: Awaited<ReturnType<Picker>> | null = null;
    let fallbackName = suggested;
    if (picker) {
      try {
        handle = await picker({ suggestedName: suggested, types: [{ description: "성적 분석기 저장 파일", accept: { "application/json": [".json"] } }] });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // 창을 닫음
        throw e;
      }
    } else {
      const name = window.prompt("저장할 파일 이름을 입력하세요. (다운로드 폴더에 저장됩니다)", suggested);
      if (!name) return;
      fallbackName = /\.json$/i.test(name) ? name : `${name}.json`;
    }
    const pw = window.prompt(
      "파일에 비밀번호를 걸까요? (선택)\n학생 이름·성적이 들어 있으니 USB·메일로 옮길 때는 거는 것을 권합니다.\n비밀번호 없이 저장하려면 비워 두고 확인을 누르세요.",
      "",
    );
    if (pw === null) return;
    const blob = await encodeSave(
      { reports, naesin, files, notes, admission: packAdmission(admission), guidelines: guidelines.length ? guidelines : undefined },
      pw,
    );
    if (handle) {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fallbackName;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    setSaveMsg(pw ? "비밀번호를 건 파일로 저장했습니다." : "저장했습니다. (비밀번호 없음 — 파일 보관에 주의하세요)");
  }

  async function loadFromFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      let pw = "";
      if (isEncrypted(text)) {
        const ans = window.prompt("저장할 때 건 비밀번호를 입력하세요.", "");
        if (ans === null) return;
        pw = ans;
      }
      const d = await decodeSave(text, pw);
      setReports(d.reports);
      setNaesin(d.naesin);
      setFiles(d.files);
      setNotes(d.notes);
      const adm = unpackAdmission(d.admission);
      setAdmission(adm);
      setGuidelines(d.guidelines ?? []);
      setSelected("");
      setSaveMsg(
        `불러왔습니다. (모의고사 ${d.reports.length}건 · 내신 ${d.naesin.students.length}명` +
          (adm.susi.length + adm.jeongsi.length ? ` · 입결 ${(adm.susi.length + adm.jeongsi.length).toLocaleString()}행` : "") +
          (d.guidelines?.length ? ` · 모집요강 ${d.guidelines.length}건` : "") +
          ")",
      );
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
    } finally {
      if (loadRef.current) loadRef.current.value = "";
    }
  }

  const mean = latest ? meanGrade(latest, opts) : null;
  const pct = latest ? percentileMean(latest) : null;
  const ext = latest ? extremes(latest) : { best: null, worst: null };
  const areasInUse = AREA_ORDER.filter((a) => mine.some((r) => gradeOf(r, a) != null));
  // 회차 선택: 처음에는 최신 회차가 보이고, 고른 회차가 이 학생에게 없으면 최신으로 돌아갑니다.
  const radarReport = mine.find((r) => r.examKey === radarExam) ?? latest;
  const minReport = mine.find((r) => r.examKey === minExam) ?? latest;
  const diagReport = mine.find((r) => r.examKey === diagExam) ?? latest;
  // "직전 대비"는 고른 회차까지의 기록으로 계산합니다(고른 회차 vs 그 바로 전 회차).
  const diagUpTo = diagReport ? mine.slice(0, mine.indexOf(diagReport) + 1) : mine;
  const radarAxes = radarReport
    ? AREA_ORDER.filter((a) => a !== "한국사" && gradeOf(radarReport, a) != null).map((a) => ({
        label: areaOf(radarReport, a)!.subject,
        grade: gradeOf(radarReport, a),
      }))
    : [];
  const trendLabels = mine.map((r) => examLabel(r));
  const trendSeries: TrendSeries[] = [
    ...areasInUse.map((a) => ({
      label: a === "탐구1" || a === "탐구2" ? `${a}(${areaOf(mine[mine.length - 1], a)?.subject ?? ""})` : a,
      color: LINE_COLORS[a],
      values: mine.map((r) => gradeOf(r, a)),
    })),
    { label: "평균등급", color: "#111827", dashed: true, values: mine.map((r) => meanGrade(r, opts)) },
  ];

  return (
    <div className="min-h-screen bg-orange-50 text-stone-900 print:bg-white">
      <header className="print:hidden border-b border-stone-200 bg-white/90">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-800 bg-white rounded-xl border border-stone-200 hover:bg-stone-50 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            허브로 돌아가기
          </Link>
          <GuideLink
            slug="score"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-700 bg-white rounded-xl border border-stone-200 hover:bg-stone-50 whitespace-nowrap"
          />
          <h1 className="text-lg font-bold">내신-모의고사 성적 분석기</h1>
          <nav className="inline-flex rounded-xl border border-stone-300 overflow-hidden text-sm" aria-label="분석 종류">
            {(
              [
                ["naesin", "내신 분석"],
                ["mock", "모의고사"],
                ["integrated", "수시·정시 통합"],
                ["admission", "입결 자료"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`px-3 py-1.5 font-medium ${tab === k ? "bg-amber-600 text-white" : "bg-white hover:bg-stone-50"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <span className="hidden md:inline text-xs text-stone-600">
            {tab === "mock"
              ? "모의고사 성적통지표 PDF를 올리면 분석 자료가 만들어집니다"
              : tab === "naesin"
                ? "교과학습발달상황 PDF를 올리면 내신 분석 자료가 만들어집니다"
                : tab === "admission"
                  ? "대학어디가 입결 엑셀을 올리면 줄여서 저장 파일에 함께 담습니다"
                  : "내신과 모의고사를 함께 올리면 수시·정시 성향을 비교해 줍니다"}
          </span>
          <div className="ml-auto flex gap-2 flex-wrap items-center">
            {saveMsg && <span className="text-xs text-stone-600" role="status">{saveMsg}</span>}
            <button
              onClick={() => void saveToFile()}
              disabled={
                !reports.length && !naesin.students.length && !admission.susi.length && !admission.jeongsi.length && !guidelines.length
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50 disabled:opacity-40"
            >
              <Save className="w-4 h-4" /> 저장하기
            </button>
            <button
              onClick={() => loadRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50"
            >
              <FolderOpen className="w-4 h-4" /> 불러오기
            </button>
            <input
              ref={loadRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => void loadFromFile(e.target.files?.[0])}
            />
          </div>
          <div className={`flex gap-2 ${tab === "mock" ? "" : "hidden"}`}>
            <button
              onClick={() => window.print()}
              disabled={!latest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" /> 인쇄 · PDF 저장
            </button>
            <button
              onClick={reset}
              disabled={!reports.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white rounded-xl border border-stone-300 hover:bg-stone-50 disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" /> 초기화
            </button>
          </div>
        </div>
      </header>

      <div className={tab === "naesin" ? "" : "hidden"}>
        <NaesinView
          students={naesin.students}
          fileName={naesin.fileName}
          onChange={(students, fileName) => setNaesin({ students, fileName })}
          notes={notes}
          onNote={setNote}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      {tab === "integrated" && (
        <IntegratedView naesin={naesin.students} reports={reports} opts={opts} goTo={setTab} notes={notes} onNote={setNote} selected={selected} onSelect={setSelected} />
      )}
      <div className={tab === "admission" ? "" : "hidden"}>
        <AdmissionView
          admission={admission}
          onChange={setAdmission}
          naesin={naesin.students}
          reports={reports}
          selected={selected}
          onSelect={setSelected}
          guidelines={guidelines}
          onGuidelines={setGuidelines}
        />
      </div>
      <div className={`max-w-[1400px] mx-auto px-4 py-3 grid gap-3 lg:grid-cols-[320px_1fr] items-start ${tab === "mock" ? "" : "hidden"}`}>
        {/* 왼쪽: 올리기·설정 */}
        <aside className="print:hidden grid gap-3 sm:grid-cols-2 lg:grid-cols-1 items-start">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-bold mb-2">1. 성적통지표 올리기</h2>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles(e.dataTransfer.files);
              }}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-6 text-center cursor-pointer hover:bg-amber-100"
            >
              <Upload className="w-6 h-6 text-amber-700" />
              <span className="text-sm font-bold">{busy ? "읽는 중…" : "PDF를 끌어다 놓거나 눌러서 고르세요"}</span>
              <span className="text-xs text-stone-600">전국연합학력평가(교육청) · 모의평가(평가원) 성적통지표 · 여러 회차를 한꺼번에 올릴 수 있습니다</span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(e) => e.target.files && void addFiles(e.target.files)}
              />
            </label>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
              파일은 이 컴퓨터(브라우저) 안에서만 읽습니다. 서버로 보내거나 저장하지 않습니다.
            </p>
            {error && <p className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs">
                    <FileText className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <b className="block truncate">{f.name}</b>
                      {f.exam} · 학생 {f.students}명{f.skipped > 0 && ` · 읽지 못한 쪽 ${f.skipped}`}
                    </span>
                    <button
                      aria-label="이 파일 목록에서 빼기"
                      onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                      className="p-0.5 text-stone-500 hover:text-stone-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </aside>

        {/* 오른쪽: 분석 */}
        <main className="space-y-3 min-w-0">
          {!latest ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
              <p className="text-lg font-bold">왼쪽에서 성적통지표 PDF를 올려 주세요</p>
              <p className="mt-2 text-sm text-stone-600">
                한 PDF에 학급 전체가 들어 있어도 됩니다. 올리면 학생을 골라 영역별 등급, 회차별 변화, 수능 최저 충족 여부를 볼 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              {/* 스크롤해도 화면 위에 붙어 있어 어디서든 학생을 바꿀 수 있습니다 */}
              <div className="print:hidden sticky top-0 z-20 flex items-center gap-2 flex-wrap rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <label className="text-sm font-bold" htmlFor="stu">
                  학생
                </label>
                <select
                  id="stu"
                  value={activeKey}
                  onChange={(e) => setSelected(students.find((s) => s.key === e.target.value)?.pkey ?? "")}
                  className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm bg-white"
                >
                  {students.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-stone-600">
                  {students.length}명 · 회차 {exams.length}개
                </span>
              </div>

              <NotesPanel pkey={personKey(latest.num, latest.name)} name={latest.name} notes={notes} onChange={setNote} />

              <section className="rounded-2xl border border-stone-200 bg-white p-4">
                <h2 className="font-bold">
                  {latest.name} · 모의고사 요약{" "}
                  <span className="ml-1 text-xs font-normal text-stone-600">
                    {latest.school} {latest.level}학년 {latest.classNo}반 {latest.num}번 · 최근 회차: {latest.examTitle}
                  </span>
                </h2>
                <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
                  <Card title="응시 회차" value={`${mine.length}회`} sub={mine.map(examLabel).join(" ~ ")} />
                  <Card title="평균등급(반영 과목)" value={mean == null ? "—" : mean.toFixed(2)} unit="등급" sub="아래에서 반영 과목을 바꿀 수 있습니다" />
                  <Card title="국·수·탐 백분위 평균" value={pct == null ? "—" : pct.toFixed(1)} sub="탐구는 2과목 평균" />
                  <Card
                    title="가장 좋은 영역"
                    value={ext.best ? `${ext.best.grade}` : "—"}
                    unit="등급"
                    sub={ext.best?.subject}
                  />
                  <Card
                    title="가장 낮은 영역"
                    value={ext.worst ? `${ext.worst.grade}` : "—"}
                    unit="등급"
                    sub={ext.worst?.subject}
                    warn
                  />
                </div>
              </section>

              <section className="print:hidden rounded-2xl border border-stone-200 bg-white p-4">
                <h2 className="font-bold">평균등급에 넣을 과목</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AREA_ORDER.filter((a) => latest && gradeOf(latest, a) != null).map((a) => (
                    <label
                      key={a}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={opts.included[a]}
                        onChange={(e) => setOpts((o) => ({ ...o, included: { ...o.included, [a]: e.target.checked } }))}
                      />
                      {a}
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={opts.inquiryMerge}
                      onChange={(e) => setOpts((o) => ({ ...o, inquiryMerge: e.target.checked }))}
                    />
                    탐구 2과목을 1과목(평균)으로 계산
                  </label>
                </div>
                <p className="mt-1 text-xs text-stone-600">지망 대학의 수능 반영 영역에 맞춰 체크하면 평균등급이 다시 계산됩니다.</p>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 overflow-x-auto">
                <h2 className="font-bold mb-1">회차별 성적표</h2>
                <p className="text-xs text-stone-600 mb-3">영어·한국사는 통지표에 원점수와 등급만 나옵니다.</p>
                {[...mine].reverse().map((r) => (
                  <ScoreTable key={r.examKey} r={r} />
                ))}
              </section>

              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-2xl border border-stone-200 bg-white p-4">
                  <h2 className="font-bold">영역별 등급</h2>
                  <p className="text-xs text-stone-600 mb-2">
                    {radarReport?.examTitle} · 바깥쪽일수록 좋은 등급입니다.
                  </p>
                  <ExamPicker reports={mine} value={radarReport?.examKey ?? ""} onChange={setRadarExam} />
                  <RadarChart axes={radarAxes} />
                </section>
                <section className="rounded-2xl border border-stone-200 bg-white p-4">
                  <h2 className="font-bold">영역별 등급 추이</h2>
                  <p className="text-xs text-stone-600 mb-2">위쪽일수록 좋은 등급입니다. 회차가 1개면 점만 보입니다.</p>
                  <TrendChart labels={trendLabels} series={trendSeries} />
                </section>
              </div>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 overflow-x-auto">
                <h2 className="font-bold">영역별 강약 진단</h2>
                <p className="text-xs text-stone-600 mb-2">{diagReport?.examTitle} 기준</p>
                <ExamPicker reports={mine} value={diagReport?.examKey ?? ""} onChange={setDiagExam} />
                <table className="w-full text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-stone-100 text-left">
                      <th className="p-2 border border-stone-200">영역</th>
                      <th className="p-2 border border-stone-200 text-center">등급</th>
                      <th className="p-2 border border-stone-200 text-center">백분위</th>
                      <th className="p-2 border border-stone-200 text-center">최고 / 최저 등급</th>
                      <th className="p-2 border border-stone-200 text-center">직전 대비</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areasInUse.map((a) => {
                      const gs = mine.map((r) => gradeOf(r, a)).filter((v): v is number => v != null);
                      const t = trendOf(diagUpTo, a);
                      const cur = diagReport ? areaOf(diagReport, a) : null;
                      return (
                        <tr key={a}>
                          <td className="p-2 border border-stone-200 font-medium">{cur?.subject ?? a}</td>
                          <td className="p-2 border border-stone-200 text-center">{fmt(cur?.grade ?? null)}</td>
                          <td className="p-2 border border-stone-200 text-center">{fmt(cur?.percentile ?? null)}</td>
                          <td className="p-2 border border-stone-200 text-center">
                            {gs.length ? `${Math.min(...gs)} / ${Math.max(...gs)}` : "—"}
                          </td>
                          <td className="p-2 border border-stone-200 text-center">
                            {t == null ? "—" : t < 0 ? <b className="text-emerald-700">▲ {-t}등급 상승</b> : t > 0 ? <b className="text-rose-700">▼ {t}등급 하락</b> : "변화 없음"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 overflow-x-auto">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h2 className="font-bold">수능 최저 시뮬레이터</h2>
                  <span className="text-xs text-stone-600">{minReport.examTitle} 기준 · 한국사 제외</span>
                  <div className="w-full">
                    <ExamPicker reports={mine} value={minReport.examKey} onChange={setMinExam} />
                  </div>
                  <label className="print:hidden ml-auto inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={inquiryMode === "avg"}
                      onChange={(e) => setInquiryMode(e.target.checked ? "avg" : "best")}
                    />
                    탐구 2과목 평균으로 계산 (기본: 좋은 1과목)
                  </label>
                </div>
                <table className="w-full text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-stone-100 text-left">
                      <th className="p-2 border border-stone-200">기준</th>
                      <th className="p-2 border border-stone-200 text-center">현재 합</th>
                      <th className="p-2 border border-stone-200 text-center">결과</th>
                      <th className="p-2 border border-stone-200">여유 / 부족</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csatMin(minReport, inquiryMode).map((m) => (
                      <tr key={m.label}>
                        <td className="p-2 border border-stone-200 font-medium">{m.label}</td>
                        <td className="p-2 border border-stone-200 text-center">{fmt(m.current)}</td>
                        <td className="p-2 border border-stone-200 text-center">
                          {m.ok == null ? (
                            "—"
                          ) : m.ok ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 font-bold">충족</span>
                          ) : (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800 font-bold">미충족</span>
                          )}
                        </td>
                        <td className="p-2 border border-stone-200 text-stone-700">{m.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ title, value, unit, sub, warn }: { title: string; value: string; unit?: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 min-w-0">
      <p className="text-xs text-stone-600">{title}</p>
      <p className={`text-2xl font-bold ${warn ? "text-rose-700" : "text-amber-800"}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-stone-600">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-stone-600 truncate">{sub}</p>}
    </div>
  );
}

function ScoreTable({ r }: { r: Report }) {
  const cols = AREA_ORDER.map((a) => areaOf(r, a)).filter((x): x is NonNullable<typeof x> => x != null);
  const rows: { label: string; get: (a: (typeof cols)[number]) => string }[] = [
    { label: "원점수", get: (a) => fmt(a.raw) },
    { label: "표준점수", get: (a) => fmt(a.standard) },
    { label: "백분위", get: (a) => fmt(a.percentile) },
    { label: "등급", get: (a) => fmt(a.grade) },
    { label: "학급석차", get: (a) => a.classRank ?? "—" },
    { label: "학교석차", get: (a) => a.schoolRank ?? "—" },
  ];
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-sm font-bold mb-1">
        {examLabel(r)} <span className="font-normal text-stone-600">{r.examTitle}
          {r.takenOn ? ` · 실시 ${r.takenOn}` : ""}
        </span>
      </p>
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr className="bg-stone-100">
            <th className="p-2 border border-stone-200 w-24"></th>
            {cols.map((a) => (
              <th key={a.area} className="p-2 border border-stone-200 text-center">
                {a.subject}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* 평가원 통지표처럼 원점수·석차가 아예 없는 줄은 숨깁니다 */}
          {rows.filter((row) => cols.some((a) => row.get(a) !== "—")).map((row) => (
            <tr key={row.label}>
              <th className="p-2 border border-stone-200 bg-stone-50 text-left font-medium">{row.label}</th>
              {cols.map((a) => (
                <td
                  key={a.area}
                  className={`p-2 border border-stone-200 text-center ${row.label === "등급" ? "font-bold text-amber-800" : ""}`}
                >
                  {row.get(a)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 시험 종류를 짧게: 교육청 연합학력평가 / 평가원 모의평가 */
const examKind = (r: Report) => (/모의평가/.test(r.examTitle) ? "평가원 모의평가" : /연합학력평가/.test(r.examTitle) ? "연합학력평가" : "모의고사");

/** 회차(시험) 고르기: 누르면 목록이 펼쳐지는 선택 상자. 회차가 1개뿐이면 보이지 않고, 인쇄에도 나오지 않습니다. */
function ExamPicker({ reports, value, onChange }: { reports: Report[]; value: string; onChange: (examKey: string) => void }) {
  if (reports.length < 2) return null;
  return (
    <label className="print:hidden mb-2 inline-flex items-center gap-2 text-sm text-stone-700">
      <span>회차</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-bold text-stone-900"
        aria-label="회차 선택"
      >
        {reports.map((r) => (
          <option key={r.examKey} value={r.examKey}>
            {examLabel(r)} · {examKind(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
