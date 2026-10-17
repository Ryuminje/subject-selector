"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Info, ShieldCheck, Upload, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { readAdmissionXlsx, type AdmKind, type AdmRow, type AdmissionState } from "../lib/admission";
import { FIT_LABEL, FIT_ORDER, REACH_GRADE, REACH_PCT, groupOffers, judge, trend, type Fit } from "../lib/compare";
import { buildPeople, peopleLabel } from "../lib/integrated";
import { COMBOS, groupOf, weightedAverage } from "../lib/naesin";
import { gradeOf, percentileMean } from "../lib/analyze";
import type { NeisStudent } from "../lib/neis";
import {
  bestGyogwa,
  evalSuneungMin,
  findGuideline,
  findTrack,
  guidelineKey,
  parseGuidelines,
  suneungMinFor,
  type ExamGrades,
  type Guideline,
} from "../lib/guideline";
import type { Report } from "../lib/types";

interface Props {
  admission: AdmissionState;
  onChange: (a: AdmissionState) => void;
  naesin: NeisStudent[];
  reports: Report[];
  /** 선택한 학생(번호|이름). 모든 탭이 함께 씁니다. */
  selected: string;
  onSelect: (key: string) => void;
  /** 모집요강 정리 JSON(대학별 반영 규칙) */
  guidelines: Guideline[];
  onGuidelines: (g: Guideline[]) => void;
  /** guidelines 중 DB(서버)에서 받아온 항목의 키. 이 항목은 여기서 지울 수 없습니다. */
  dbKeys?: Set<string>;
  /** 이 브라우저에서 직접 올린 항목(관리자가 DB 에 저장할 대상) */
  localGuidelines?: Guideline[];
  onSavedToDb?: () => Promise<void>;
}

const KIND_LABEL: Record<AdmKind, string> = { susi: "수시", jeongsi: "정시" };
const FIT_STYLE: Record<Fit, string> = {
  safe: "bg-emerald-100 text-emerald-800",
  fair: "bg-sky-100 text-sky-800",
  reach: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};
const f = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toFixed(d).replace(/\.?0+$/, "") || "0");
const MAX_ROWS = 100;

/** 한 해의 컷을 "50%~70%" 로 */
function cutText(r: AdmRow | undefined) {
  if (!r) return "—";
  const [a, b] = r.kind === "susi" ? [r.g50, r.g70] : [r.p50, r.p70];
  if (a == null && b == null) return "—";
  if (a != null && b != null && a !== b) return `${f(a)}~${f(b)}`;
  return f(a ?? b);
}

export function AdmissionView({ admission, onChange, naesin, reports, selected, onSelect, guidelines, onGuidelines, dbKeys, localGuidelines, onSavedToDb }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  // 관리자만: 직접 올린 모집요강을 서버 DB 에 저장합니다. 모두에게 보이게 됩니다.
  async function saveToDb() {
    if (!localGuidelines?.length) return;
    if (!window.confirm(`직접 올린 모집요강 ${localGuidelines.length}건을 서버에 저장합니다. 같은 대학·구분은 덮어씁니다. 계속할까요?`)) return;
    setBusy("서버에 저장하는 중…");
    setError("");
    try {
      const r = await fetch("/api/admission-guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: localGuidelines }),
      });
      const d = (await r.json().catch(() => ({}))) as { saved?: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? "저장하지 못했습니다.");
      await onSavedToDb?.();
      setError(`서버에 ${d.saved}건 저장했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    }
    setBusy("");
  }
  const [kind, setKind] = useState<AdmKind>("susi");
  const [univ, setUniv] = useState("");
  const [dept, setDept] = useState("");
  const [type, setType] = useState("");
  const [fitFilter, setFitFilter] = useState<Fit | "">("");
  const [comboKey, setComboKey] = useState("kems");
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((x) => /\.(xlsx?|json)$/i.test(x.name));
    if (!files.length) {
      setError("입결 엑셀(.xlsx)이나 모집요강 정리 파일(.json)만 올릴 수 있습니다.");
      return;
    }
    setError("");
    let next = admission;
    let nextGuidelines = guidelines;
    for (const file of files) {
      setBusy(`"${file.name}" 읽는 중… (큰 파일은 10~20초 걸립니다)`);
      try {
        if (/\.json$/i.test(file.name)) {
          const incoming = parseGuidelines(await file.text());
          // 같은 대학·구분·학년도는 새 파일로 바꿉니다(통합 파일은 여러 대학이 한꺼번에 들어옵니다)
          const keys = new Set(incoming.map(guidelineKey));
          nextGuidelines = [...nextGuidelines.filter((x) => !keys.has(guidelineKey(x))), ...incoming];
          onGuidelines(nextGuidelines);
          continue;
        }
        const r = await readAdmissionXlsx(file);
        next = { ...next, [r.kind]: r.rows, sources: { ...next.sources, [r.kind]: file.name } };
        onChange(next);
        setKind(r.kind);
      } catch (e) {
        setError(e instanceof Error ? e.message : "파일을 읽는 중 문제가 생겼습니다.");
      }
    }
    setBusy("");
    if (inputRef.current) inputRef.current.value = "";
  }

  // ---- 학생 성적 ----
  const people = useMemo(() => buildPeople(naesin, reports), [naesin, reports]);
  const person = people.find((p) => p.key === selected) ?? people[0];
  const combo = COMBOS.find((c) => c.key === comboKey) ?? COMBOS[0];
  const myGrade = person?.naesin ? weightedAverage(person.naesin.courses.filter((c) => combo.has(groupOf(c.subject)))).avg : null;
  const myGradeR = myGrade == null ? null : Math.round(myGrade * 100) / 100;
  const latestMock = person?.mock[person.mock.length - 1];
  const myPct = latestMock ? percentileMean(latestMock) : null;
  const myEng = latestMock ? gradeOf(latestMock, "영어") : null;
  const myScore = kind === "susi" ? myGradeR : myPct;

  // ---- 입결 ----
  const rows = admission[kind];
  const offers = useMemo(() => groupOffers(rows), [rows]);
  const years = useMemo(
    () => [...new Set(rows.map((r) => r.year).filter((y): y is number => y != null))].sort((a, b) => a - b).slice(-4),
    [rows],
  );
  const types = useMemo(() => [...new Set(rows.map((r) => r.type).filter(Boolean))], [rows]);

  const result = useMemo(() => {
    const u = univ.trim();
    const d = dept.trim();
    if (!u && !d) return [];
    const t1 = latestMock ? gradeOf(latestMock, "탐구1") : null;
    const t2 = latestMock ? gradeOf(latestMock, "탐구2") : null;
    const exam: ExamGrades | null = latestMock
      ? {
          국어: gradeOf(latestMock, "국어"),
          수학: gradeOf(latestMock, "수학"),
          영어: gradeOf(latestMock, "영어"),
          탐구: t1 != null && t2 != null ? Math.min(t1, t2) : (t1 ?? t2),
          탐구2: t1 != null && t2 != null ? Math.max(t1, t2) : null,
        }
      : null;
    return offers
      .filter((o) => (!u || o.univ.includes(u)) && (!d || o.dept.includes(d)) && (!type || o.type === type))
      .map((o) => {
        const g = findGuideline(guidelines, o.univ, kind);
        // 대학이 정한 반영 교과·방식으로 다시 계산한 값이 있으면 그것으로 비교합니다.
        let my = myScore;
        let myNote: string | null = null;
        if (kind === "susi" && g?.engine?.gyogwa && o.type === "교과" && person?.naesin) {
          const r = bestGyogwa(person.naesin.courses, g.engine.gyogwa, { field: o.field, dept: o.dept, track: o.track });
          if (r) {
            my = r.value;
            myNote = r.label;
          }
        }
        const track = g ? findTrack(g, o.track) : undefined;
        const rule = kind === "susi" ? suneungMinFor(track, o.dept, o.field) : undefined;
        const ok = rule && exam ? evalSuneungMin(rule.rule, exam) : null;
        return { o, j: judge(o, my), t: trend(o), my, myNote, g, rule, ok };
      })
      .filter((x) => !fitFilter || x.j?.fit === fitFilter)
      .sort(
        (a, b) =>
          a.o.univ.localeCompare(b.o.univ, "ko") || a.o.dept.localeCompare(b.o.dept, "ko") || a.o.track.localeCompare(b.o.track, "ko"),
      );
  }, [offers, univ, dept, type, fitFilter, myScore, guidelines, kind, person, latestMock]);

  const has = admission.susi.length > 0 || admission.jeongsi.length > 0;
  const showMin = kind === "susi" && guidelines.some((g) => g.source.kind === "수시");
  const fitCount = useMemo(() => {
    const c: Record<Fit, number> = { safe: 0, fair: 0, reach: 0, high: 0 };
    for (const x of result) if (x.j) c[x.j.fit] += 1;
    return c;
  }, [result]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-3 grid gap-3 lg:grid-cols-[320px_1fr] items-start">
      <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 items-start">
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="font-bold mb-2">1. 입결 자료 올리기</h2>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(e.dataTransfer.files);
            }}
            className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-6 text-center cursor-pointer hover:bg-amber-100"
          >
            <Upload className="w-6 h-6 text-amber-700" />
            <span className="text-sm font-bold">{busy ? "읽는 중…" : "엑셀을 끌어다 놓거나 눌러서 고르세요"}</span>
            <span className="text-xs text-stone-600">
              대학어디가 수시·정시 입결자료 엑셀(&lsquo;대학자료&rsquo; 시트)과 모집요강 정리 파일(.json)을 함께 올릴 수 있습니다
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.json"
              multiple
              disabled={!!busy}
              className="sr-only"
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </label>
          {busy && (
            <p className="mt-2 text-xs text-stone-700" role="status">
              {busy}
            </p>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
            파일은 이 컴퓨터(브라우저) 안에서만 읽습니다. 필요한 열만 남겨 줄이고, 위쪽 &lsquo;저장하기&rsquo;를 누르면 저장 파일에 함께 담깁니다.
          </p>
          {error && <p className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {has && (
            <ul className="mt-3 space-y-1.5">
              {(["susi", "jeongsi"] as const)
                .filter((k) => admission[k].length)
                .map((k) => {
                  const ys = admission[k].map((r) => r.year).filter((y): y is number => y != null);
                  return (
                    <li key={k} className="flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs">
                      <FileText className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
                      <span className="flex-1 min-w-0">
                        <b className="block truncate">
                          {KIND_LABEL[k]} · {admission.sources[k] ?? "저장 파일에서 불러옴"}
                        </b>
                        {admission[k].length.toLocaleString()}행 · 대학 {new Set(admission[k].map((r) => r.univ)).size}곳 ·{" "}
                        {Math.min(...ys)}~{Math.max(...ys)}학년도
                      </span>
                      <button
                        aria-label={`${KIND_LABEL[k]} 입결 자료 지우기`}
                        onClick={() => onChange({ ...admission, [k]: [], sources: { ...admission.sources, [k]: undefined } })}
                        className="p-0.5 text-stone-500 hover:text-stone-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
          {guidelines.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-stone-700">
                모집요강 (대학별 반영 규칙) {guidelines.length}건
                {dbKeys && dbKeys.size > 0 && <span className="ml-1 font-normal text-stone-600">· 서버 자료 {dbKeys.size}건은 자동으로 불러옵니다</span>}
              </p>
              {isAdmin && !!localGuidelines?.length && (
                <button
                  onClick={() => void saveToDb()}
                  disabled={!!busy}
                  className="mt-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  직접 올린 {localGuidelines.length}건을 서버에 저장 (관리자)
                </button>
              )}
              <ul className="mt-1.5 space-y-1.5">
                {guidelines.map((g) => (
                  <li key={guidelineKey(g)} className="flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs">
                    <FileText className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <b className="block truncate">
                        {g.source.shortName}
                        {g.source.campus ? `(${g.source.campus})` : ""} · {g.source.kind} · {g.source.admissionYear}학년도
                      </b>
                      <span className={g.review.status === "확인됨" ? "text-emerald-700" : "text-amber-700"}>{g.review.status}</span>
                      {g.engine?.gyogwa?.length ? " · 교과 계산 규칙 있음" : ""}
                    </span>
                    {!(dbKeys?.has(guidelineKey(g)) && !localGuidelines?.includes(g)) && (
                      <button
                        aria-label={`${g.source.shortName} ${g.source.kind} 모집요강 지우기`}
                        onClick={() => onGuidelines(guidelines.filter((x) => guidelineKey(x) !== guidelineKey(g)))}
                        className="p-0.5 text-stone-500 hover:text-stone-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-700 space-y-1.5">
          <h2 className="font-bold text-sm">읽는 기준</h2>
          <p>수시 컷은 합격자 내신 등급의 50%·70% 지점, 정시 컷은 합격자 백분위 평균의 50%·70% 지점입니다.</p>
          <p>
            <b>안정</b> 50% 컷보다 좋음 · <b>적정</b> 70% 컷 안쪽 · <b>소신</b> 70% 컷보다 수시 {REACH_GRADE}등급(정시 {REACH_PCT}점) 이내 ·{" "}
            <b>상향</b> 그보다 멀음.
          </p>
          <p>가장 최근 연도의 컷으로 판정합니다. 대학마다 반영 교과·학년이 달라 참고용이며, 합격 가능성을 뜻하지 않습니다.</p>
          <p>자료 출처는 대학어디가 발표 자료를 정리한 선생님 개인 작업물입니다. 학교 밖으로 공유할 때는 출처를 확인하세요.</p>
        </section>
      </aside>

      <main className="space-y-3 min-w-0">
        {!has ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-lg font-bold">왼쪽에서 입결 자료 엑셀을 올려 주세요</p>
            <p className="mt-2 text-sm text-stone-600">
              올리면 학생 성적과 대학·학과별 입결을 비교해 안정·적정·소신·상향을 보여 주고, 저장하기를 누를 때 줄인 자료가 함께 저장됩니다.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold mb-3">비교할 학생</h2>
              {people.length === 0 ? (
                <p className="text-sm text-stone-600">
                  내신 분석 또는 모의고사 탭에서 학생 성적 자료를 먼저 올려 주세요. 올리지 않아도 아래에서 입결은 찾아볼 수 있습니다.
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs font-medium text-stone-700">
                    학생
                    <select
                      value={person?.key ?? ""}
                      onChange={(e) => onSelect(e.target.value)}
                      className="mt-1 block rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-normal"
                    >
                      {people.map((p) => (
                        <option key={p.key} value={p.key}>
                          {peopleLabel(p)}
                          {!p.naesin ? " (내신 없음)" : !p.mock.length ? " (모의고사 없음)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-stone-700">
                    수시 비교에 쓸 내신 과목
                    <select
                      value={comboKey}
                      onChange={(e) => setComboKey(e.target.value)}
                      className="mt-1 block rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-normal"
                    >
                      {COMBOS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
                      <p className="text-xs text-stone-600">내신 평균등급</p>
                      <p className="text-lg font-bold text-amber-800">{myGradeR == null ? "—" : myGradeR.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
                      <p className="text-xs text-stone-600">국·수·탐 백분위</p>
                      <p className="text-lg font-bold text-amber-800">{myPct == null ? "—" : myPct.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
                      <p className="text-xs text-stone-600">영어 등급</p>
                      <p className="text-lg font-bold text-amber-800">{myEng ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}
              {people.length > 0 && myScore == null && (
                <p className="mt-2 text-xs text-rose-700">
                  {kind === "susi" ? "이 학생의 내신 자료가 없어 수시 판정을 할 수 없습니다." : "이 학생의 모의고사 자료가 없어 정시 판정을 할 수 없습니다."}
                </p>
              )}
              {latestMock && <p className="mt-2 text-xs text-stone-600">정시 비교는 가장 최근 모의고사({latestMock.examTitle})의 백분위로 계산합니다.</p>}
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold mb-3">대학·학과 찾기와 비교</h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-medium text-stone-700">
                  구분
                  <select
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as AdmKind);
                      setType("");
                    }}
                    className="mt-1 block rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-normal"
                  >
                    {(["susi", "jeongsi"] as const).map((k) => (
                      <option key={k} value={k} disabled={!admission[k].length}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-700">
                  대학
                  <input
                    value={univ}
                    onChange={(e) => setUniv(e.target.value)}
                    placeholder="예) 전남대"
                    className="mt-1 block w-36 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-normal"
                  />
                </label>
                <label className="text-xs font-medium text-stone-700">
                  학과
                  <input
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    placeholder="예) 간호"
                    className="mt-1 block w-36 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-normal"
                  />
                </label>
                {kind === "susi" && types.length > 0 && (
                  <label className="text-xs font-medium text-stone-700">
                    전형 종류
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="mt-1 block rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-normal"
                    >
                      <option value="">전체</option>
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs font-medium text-stone-700">
                  판정
                  <select
                    value={fitFilter}
                    onChange={(e) => setFitFilter(e.target.value as Fit | "")}
                    className="mt-1 block rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-normal"
                  >
                    <option value="">전체</option>
                    {FIT_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {FIT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!univ.trim() && !dept.trim() ? (
                <p className="mt-4 text-sm text-stone-600">대학 이름이나 학과 이름 일부를 입력하면 결과가 나옵니다.</p>
              ) : result.length === 0 ? (
                <p className="mt-4 text-sm text-stone-600">맞는 결과가 없습니다.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <p className="text-xs text-stone-600 mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      {result.length.toLocaleString()}건{result.length > MAX_ROWS && ` 중 ${MAX_ROWS}건만 표시 — 조건을 좁혀 보세요`}
                    </span>
                    {myScore != null &&
                      FIT_ORDER.map((k) => (
                        <span key={k}>
                          <b>{FIT_LABEL[k]}</b> {fitCount[k]}
                        </span>
                      ))}
                  </p>
                  <table className="w-full text-sm border-collapse min-w-[860px]">
                    <thead>
                      <tr className="bg-stone-100 text-left">
                        <th className="p-2 border border-stone-200">대학</th>
                        <th className="p-2 border border-stone-200">전형</th>
                        <th className="p-2 border border-stone-200">학과</th>
                        <th className="p-2 border border-stone-200 text-center">모집</th>
                        <th className="p-2 border border-stone-200 text-center">경쟁률</th>
                        <th className="p-2 border border-stone-200 text-center">충원</th>
                        {years.map((y) => (
                          <th key={y} className="p-2 border border-stone-200 text-center">
                            {y} {kind === "susi" ? "등급컷" : "백분위컷"}
                          </th>
                        ))}
                        <th className="p-2 border border-stone-200 text-center">내 성적</th>
                        <th className="p-2 border border-stone-200 text-center">판정</th>
                        <th className="p-2 border border-stone-200 text-center">컷 대비</th>
                        <th className="p-2 border border-stone-200 text-center">추세</th>
                        {showMin && <th className="p-2 border border-stone-200">수능 최저</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {result.slice(0, MAX_ROWS).map(({ o, j, t, my, myNote, rule, ok }) => {
                        const base =
                          (j ? o.years.get(j.year) : undefined) ??
                          [...o.years.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
                        return (
                          <tr key={o.key}>
                            <td className="p-2 border border-stone-200 whitespace-nowrap">{o.univ}</td>
                            <td className="p-2 border border-stone-200">{o.track}</td>
                            <td className="p-2 border border-stone-200">{o.dept}</td>
                            <td className="p-2 border border-stone-200 text-center">{f(base?.quota, 0)}</td>
                            <td className="p-2 border border-stone-200 text-center">{f(base?.rate)}</td>
                            <td className="p-2 border border-stone-200 text-center">{f(base?.extra, 0)}</td>
                            {years.map((y) => (
                              <td
                                key={y}
                                className={`p-2 border border-stone-200 text-center ${j?.year === y ? "font-bold text-amber-800" : ""}`}
                              >
                                {cutText(o.years.get(y))}
                              </td>
                            ))}
                            <td className="p-2 border border-stone-200 text-center whitespace-nowrap" title={myNote ?? "공통 기준(대학별 규칙 없음)"}>
                              {my == null ? (
                                "—"
                              ) : (
                                <>
                                  {f(my)}
                                  {myNote ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">대학 방식</span> : null}
                                </>
                              )}
                            </td>
                            <td className="p-2 border border-stone-200 text-center">
                              {j ? (
                                <span className={`rounded px-2 py-0.5 font-bold ${FIT_STYLE[j.fit]}`}>{FIT_LABEL[j.fit]}</span>
                              ) : (
                                <span className="text-stone-400">—</span>
                              )}
                            </td>
                            <td className="p-2 border border-stone-200 text-center">
                              {j ? (
                                <span className={j.margin >= 0 ? "text-emerald-700" : "text-rose-700"}>
                                  {j.margin >= 0 ? "+" : ""}
                                  {f(j.margin)}
                                  {kind === "susi" ? "등급" : "점"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-2 border border-stone-200 text-center text-xs">
                              {t == null ? (
                                "—"
                              ) : t.delta === 0 ? (
                                "변화 없음"
                              ) : t.harder ? (
                                <span className="text-rose-700">어려워짐</span>
                              ) : (
                                <span className="text-emerald-700">쉬워짐</span>
                              )}
                            </td>
                            {showMin && (
                              <td className="p-2 border border-stone-200 text-xs">
                                {rule ? (
                                  <>
                                    <span className="text-stone-700">{rule.rule}</span>{" "}
                                    {ok == null ? (
                                      <span className="text-stone-500">(자동 판정 불가)</span>
                                    ) : ok ? (
                                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">충족</span>
                                    ) : (
                                      <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800">미충족</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-stone-400">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    굵게 표시한 연도의 컷으로 판정했습니다. &lsquo;컷 대비&rsquo;는 70% 컷과의 차이(+는 여유)이고, 추세는 최근 두 해 컷의 변화입니다.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
