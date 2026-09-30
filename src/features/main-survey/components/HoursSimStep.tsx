"use client";

import React, { useId, useState } from "react";
import { BookmarkPlus, Calculator, Download, Import, Plus, Save, Trash2, X } from "lucide-react";
import { exportCategorySummaryXlsx } from "../hooks/useMainClassSummary";
import { HoursCompareView } from "./HoursCompareView";
import { simId, toSummaryRows, totalsOf, yearTotalOf, type SimBaseline, type SimCategory, type SimPlan, type SimSubject, type SimType } from "../lib/hoursSim";

export interface CurriculumCandidate {
  subject: string;
  type: SimType;
  credits: number;
}

// 6단계 화면과 같은 색: 지정 = 초록, 선택 = 연노랑
const TYPE_BG: Record<SimType, string> = { 지정: "bg-emerald-500/10", 선택: "bg-amber-50" };
const CELL = "px-1.5 py-1 text-center border-r border-stone-300";
// 칸이 표 배경에 묻히도록 평소엔 테두리·배경 없이 글자만 보이고, 마우스를 올리거나 고칠 때만 테두리가 드러납니다.
const INPUT =
  "w-full bg-transparent border border-transparent rounded px-1 py-0.5 text-center text-stone-800 text-sm outline-none transition-colors hover:border-stone-300 hover:bg-white/60 focus:border-amber-500 focus:bg-white";
// 선택 목록은 기본 화살표가 좁은 칸의 글자를 가려서(학년이 안 보이던 원인) 화살표를 없앱니다.
const SELECT = `${INPUT} appearance-none cursor-pointer`;
// 숫자 칸의 위아래 화살표도 칸을 좁혀 숫자를 가리므로 없앱니다(키보드 위·아래 키로는 여전히 바뀝니다).
const NUMBER = `${INPUT} min-w-[2.5rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

/** 숫자 칸. 타이핑 중 빈칸을 허용하고, 벗어나거나 Enter 를 누를 때 반영합니다. */
function NumInput({ value, onCommit, label, className = "" }: { value: number; onCommit: (v: number) => void; label: string; className?: string }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Math.floor(Number(text));
    if (text.trim() !== "" && Number.isFinite(n) && n >= 0) {
      if (n !== value) onCommit(n);
    } else {
      setText(String(value));
    }
  };
  return (
    <input
      type="number"
      min={0}
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${NUMBER} ${className}`}
    />
  );
}

const savedLabel = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} 저장`;
};

export function HoursSimStep({
  cats,
  setCats,
  canImport,
  onImport,
  candidates,
  plans,
  setPlans,
  activePlanId,
  setActivePlanId,
  baseline,
  setBaseline,
}: {
  cats: SimCategory[];
  setCats: React.Dispatch<React.SetStateAction<SimCategory[]>>;
  canImport: boolean;
  onImport: () => SimCategory[];
  candidates: CurriculumCandidate[];
  plans: SimPlan[];
  setPlans: React.Dispatch<React.SetStateAction<SimPlan[]>>;
  activePlanId: string | null;
  setActivePlanId: (id: string | null) => void;
  baseline: SimBaseline | null;
  setBaseline: (b: SimBaseline | null) => void;
}) {
  const listId = useId();
  const [view, setView] = useState<"edit" | "compare">("edit");
  const [newCat, setNewCat] = useState("");
  const [planName, setPlanName] = useState("");

  // ── 여러 안 저장·불러오기 ──
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  // 지금 표가 불러온 안과 달라졌는지(안을 불러오지 않았으면 표에 내용이 있을 때 저장 안 된 것으로 봄)
  const dirty = activePlan ? JSON.stringify(activePlan.cats) !== JSON.stringify(cats) : cats.length > 0;

  // 지운 안이 있어도 이름이 겹치지 않게 비어 있는 가장 작은 번호를 씁니다.
  let n = 1;
  while (plans.some((p) => p.name === `${n}안`)) n++;
  const defaultName = `${n}안`;

  const saveAsNewPlan = () => {
    const name = planName.trim() || defaultName;
    const plan: SimPlan = { id: simId(), name, savedAt: new Date().toISOString(), cats: structuredClone(cats) };
    setPlans((prev) => [...prev, plan]);
    setActivePlanId(plan.id);
    setPlanName("");
  };
  const overwritePlan = () => {
    if (!activePlan) return;
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, savedAt: new Date().toISOString(), cats: structuredClone(cats) } : p)));
  };
  const loadPlan = (plan: SimPlan) => {
    if (plan.id === activePlanId && !dirty) return;
    if (dirty && !window.confirm(`저장하지 않은 수정이 있습니다. 버리고 「${plan.name}」을 불러올까요?`)) return;
    setCats(structuredClone(plan.cats));
    setActivePlanId(plan.id);
  };
  const renamePlan = (plan: SimPlan) => {
    const name = window.prompt("안 이름", plan.name)?.trim();
    if (name) setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, name } : p)));
  };
  const deletePlan = (plan: SimPlan) => {
    if (!window.confirm(`「${plan.name}」을 지울까요? 지금 표의 내용은 그대로 남습니다.`)) return;
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    if (plan.id === activePlanId) setActivePlanId(null);
  };

  const patchCat = (id: string, patch: Partial<SimCategory>) => setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const patchSubject = (catId: string, sem: "sem1" | "sem2", id: string, patch: Partial<SimSubject>) =>
    setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, [sem]: c[sem].map((s) => (s.id === id ? { ...s, ...patch } : s)) } : c)));
  const removeSubject = (catId: string, sem: "sem1" | "sem2", id: string) =>
    setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, [sem]: c[sem].filter((s) => s.id !== id) } : c)));
  const addSubject = (catId: string, sem: "sem1" | "sem2") =>
    setCats((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        const last = c[sem][c[sem].length - 1];
        const fresh: SimSubject = { id: simId(), grade: last?.grade ?? "2", subject: "", type: "선택", credits: 3, classes: 1 };
        return { ...c, [sem]: [...c[sem], fresh] };
      }),
    );

  // 편성표에 있는 과목명을 고르면 그 과목의 구분·학점도 함께 채웁니다.
  const setSubjectName = (catId: string, sem: "sem1" | "sem2", id: string, name: string) => {
    const hit = candidates.find((c) => c.subject === name);
    patchSubject(catId, sem, id, hit ? { subject: name, type: hit.type, credits: hit.credits } : { subject: name });
  };

  const importFromStep6 = () => {
    if (cats.length > 0 && !window.confirm("지금 7단계에서 고친 내용을 지우고 6단계 결과로 다시 채울까요?")) return;
    const imported = onImport();
    setCats(imported);
    setActivePlanId(null); // 6단계에서 새로 가져온 표는 저장한 안과 별개입니다.
    // 가져온 순간의 6단계 표를 「안 비교」의 기준으로 따로 둡니다(이후 6단계가 바뀌어도 기준은 그대로).
    setBaseline({ savedAt: new Date().toISOString(), cats: structuredClone(imported) });
  };

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    setCats((prev) => [...prev, { id: simId(), name, teachers: 0, reduction: 0, sem1: [], sem2: [] }]);
    setNewCat("");
  };

  const removeCategory = (c: SimCategory) => {
    if ((c.sem1.length || c.sem2.length) && !window.confirm(`「${c.name}」 교과와 그 안의 과목을 모두 지울까요?`)) return;
    setCats((prev) => prev.filter((x) => x.id !== c.id));
  };

  const exportXlsx = () => {
    const teacherCounts = Object.fromEntries(cats.map((c) => [c.name, c.teachers]));
    exportCategorySummaryXlsx(toSummaryRows(cats), teacherCounts, "교과(군)별 시수 조정표", "교과군별_시수조정표.xlsx");
  };

  const totals = cats.map(totalsOf);
  const totalSem1Hours = totals.reduce((a, t) => a + t.sem1TotalOriginal, 0);
  const totalSem2Hours = totals.reduce((a, t) => a + t.sem2TotalOriginal, 0);
  const totalYear = totals.reduce((a, t) => a + t.yearTotal, 0);

  const subjectCells = (c: SimCategory, sem: "sem1" | "sem2", s: SimSubject | undefined) => {
    if (!s) return <td colSpan={7} className="border-r border-stone-300" />;
    const bg = TYPE_BG[s.type];
    return (
      <>
        <td className={`${CELL} ${bg} w-12`}>
          <select value={s.grade} onChange={(e) => patchSubject(c.id, sem, s.id, { grade: e.target.value })} className={`${SELECT} min-w-[2rem]`} aria-label="학년" title="학년 바꾸기">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </td>
        <td className={`${CELL} ${bg} min-w-[9rem]`}>
          <input
            list={listId}
            value={s.subject}
            placeholder="과목명"
            onChange={(e) => setSubjectName(c.id, sem, s.id, e.target.value)}
            className={`${INPUT} text-left`}
            aria-label="과목명"
          />
        </td>
        <td className={`${CELL} ${bg} w-16`}>
          <select value={s.type} onChange={(e) => patchSubject(c.id, sem, s.id, { type: e.target.value as SimType })} className={`${SELECT} min-w-[3rem]`} aria-label="구분" title="지정·선택 바꾸기">
            <option value="지정">지정</option>
            <option value="선택">선택</option>
          </select>
        </td>
        <td className={`${CELL} ${bg} w-14`}>
          <NumInput value={s.credits} label="운영학점" onCommit={(credits) => patchSubject(c.id, sem, s.id, { credits })} />
        </td>
        <td className={`${CELL} ${bg} w-14`}>
          <NumInput value={s.classes} label="개설반" onCommit={(classes) => patchSubject(c.id, sem, s.id, { classes })} />
        </td>
        <td className={`${CELL} ${bg} w-14 font-medium text-stone-700`}>{s.credits * s.classes}</td>
        <td className={`px-1 py-1 text-center border-r border-stone-300 ${bg} w-6`}>
          <button onClick={() => removeSubject(c.id, sem, s.id)} aria-label={`${s.subject || "과목"} 삭제`} className="text-stone-400 hover:text-rose-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </td>
      </>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-amber-600" />
          7단계: 교과별 시수 조정
        </h2>
        <div className="flex p-1 bg-stone-100 rounded-xl border border-stone-200">
          {(
            [
              ["edit", "편집"],
              ["compare", "안 비교"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === key ? "bg-white text-stone-900 shadow border border-stone-200" : "text-stone-500 hover:text-stone-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "edit" && (
        <>
        <button
          onClick={importFromStep6}
          disabled={!canImport}
          title={canImport ? "6단계 표를 복사해 시작합니다" : "6단계에 표시할 데이터가 아직 없습니다"}
          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 text-sm font-medium rounded-xl border border-amber-300 flex items-center gap-2"
        >
          <Import className="w-4 h-4" /> 6단계 결과 가져오기
        </button>
        <button
          onClick={exportXlsx}
          disabled={cats.length === 0}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-500/25 flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> 엑셀 다운로드
        </button>
        <div className="ml-auto flex items-center gap-4 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-500/10 border border-emerald-300" />지정과목</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-300" />선택과목</span>
        </div>
        </>
        )}
      </div>

      {view === "compare" ? (
        <HoursCompareView
          baseline={baseline}
          plans={plans}
          currentCats={cats}
          canRebase={canImport}
          onRebase={() => setBaseline({ savedAt: new Date().toISOString(), cats: onImport() })}
        />
      ) : (
      <>
      <p className="text-sm text-stone-600">
        6단계와 따로 쓰는 연습판입니다. 여기서 고친 내용은 6단계나 원래 데이터를 바꾸지 않습니다. 과목을 더하거나 빼고, 구분·학점·반 수를 바꾸면 교과별 시수와 평균이 바로 다시 계산됩니다.
      </p>

      <div className="bg-white/80 border border-stone-200 rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-stone-800 mr-1">저장한 안</span>
        {plans.length === 0 && <span className="text-xs text-stone-500">아직 없습니다. 표를 고친 뒤 오른쪽에서 새 안으로 저장하세요.</span>}
        {plans.map((p) => {
          const on = p.id === activePlanId;
          return (
            <span
              key={p.id}
              className={`inline-flex items-center rounded-xl border text-sm transition-colors ${on ? "bg-amber-500 border-amber-500 text-white shadow" : "bg-white border-stone-300 text-stone-700 hover:border-amber-400"}`}
            >
              <button
                onClick={() => loadPlan(p)}
                onDoubleClick={() => renamePlan(p)}
                title={`${savedLabel(p.savedAt)} · 눌러서 불러오기, 두 번 눌러 이름 바꾸기`}
                className="pl-3 pr-1.5 py-1.5 font-medium"
              >
                {p.name}
                <span className={`ml-1.5 text-[11px] font-normal ${on ? "text-white/80" : "text-stone-500"}`}>{yearTotalOf(p.cats).toLocaleString()}시수</span>
                {on && dirty && <span className="ml-1 text-[11px] font-normal">(수정됨)</span>}
              </button>
              <button onClick={() => deletePlan(p)} aria-label={`${p.name} 삭제`} className={`pr-2 pl-0.5 py-1.5 ${on ? "text-white/70 hover:text-white" : "text-stone-400 hover:text-rose-600"}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          );
        })}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAsNewPlan();
          }}
          className="ml-auto flex items-center gap-2"
        >
          {activePlan && dirty && (
            <button type="button" onClick={overwritePlan} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-medium rounded-lg border border-amber-300 flex items-center gap-1">
              <Save className="w-4 h-4" /> 「{activePlan.name}」에 덮어쓰기
            </button>
          )}
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder={defaultName}
            className="w-28 bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-sm text-stone-800"
            aria-label="새 안 이름"
          />
          <button type="submit" disabled={cats.length === 0} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center gap-1">
            <BookmarkPlus className="w-4 h-4" /> 새 안으로 저장
          </button>
        </form>
      </div>

      <datalist id={listId}>
        {candidates.map((c) => (
          <option key={c.subject} value={c.subject}>{`${c.type} · ${c.credits}학점`}</option>
        ))}
      </datalist>

      {cats.length === 0 ? (
        <div className="py-12 text-center text-sm text-stone-600 bg-stone-50 border border-dashed border-stone-300 rounded-2xl">
          {canImport ? "「6단계 결과 가져오기」로 시작하거나, 아래에서 교과를 직접 추가하세요." : "아래에서 교과를 직접 추가해 시작하세요. 6단계 데이터가 있으면 그대로 가져올 수도 있습니다."}
        </div>
      ) : (
        <div className="bg-stone-100 rounded-2xl border border-stone-300 overflow-x-auto shadow-inner">
          <table className="w-full text-sm text-stone-600">
            <thead className="text-xs text-stone-600 bg-stone-100 border-b border-stone-300">
              <tr>
                <th rowSpan={2} className="px-3 py-2 text-center border-r border-stone-300">교과</th>
                <th rowSpan={2} className="px-3 py-2 text-center border-r border-stone-300">교사 수</th>
                <th colSpan={9} className="px-3 py-2 text-center border-r border-b border-stone-300">1학기</th>
                <th colSpan={9} className="px-3 py-2 text-center border-r border-b border-stone-300">2학기</th>
                <th rowSpan={2} className="px-3 py-2 text-center border-r border-stone-300">교과별<br />1년 시수</th>
                <th rowSpan={2} className="px-3 py-2 text-center">교과별<br />1년 평균<br />(학기당 평균)</th>
              </tr>
              <tr>
                {[1, 2].map((n) => (
                  <React.Fragment key={n}>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">학년</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">과목명</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">구분</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">운영학점</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">개설반</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">과목별 시수</th>
                    <th className="border-r border-stone-300" />
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">교과별<br />총 시수</th>
                    <th className="px-1.5 py-2 text-center border-r border-stone-300">교과별<br />평균시수</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((c, ci) => {
                const t = totals[ci];
                const n = Math.max(c.sem1.length, c.sem2.length) + 1; // 마지막 줄은 「과목 추가」
                return Array.from({ length: n }, (_, i) => {
                  const addRow = i === n - 1;
                  const span = (content: React.ReactNode, cls: string) =>
                    i === 0 ? <td rowSpan={n} className={`px-3 py-2 text-center border-r border-stone-300 align-middle ${cls}`}>{content}</td> : null;
                  const semTotal = (total: number, original: number) =>
                    c.reduction > 0 ? (
                      <div className="flex flex-col items-center">
                        <span>{total}</span>
                        <span className="text-[10px] text-rose-700 font-normal opacity-80 mt-1">({original}-{c.reduction})</span>
                      </div>
                    ) : total;
                  return (
                    <tr key={`${c.id}-${i}`} className={`border-b border-stone-300 ${i === 0 ? "border-t-2 border-t-slate-600/80" : ""}`}>
                      {span(
                        <div className="flex flex-col items-center gap-1.5 min-w-[5.5rem]">
                          <input value={c.name} onChange={(e) => patchCat(c.id, { name: e.target.value })} className={`${INPUT} font-medium`} aria-label="교과명" />
                          <label className="flex items-center gap-1 text-[11px] text-rose-700" title="수석교사 감축 시수(학기마다 뺍니다)">
                            감축
                            <NumInput value={c.reduction} label="수석교사 감축 시수" onCommit={(reduction) => patchCat(c.id, { reduction })} className="!w-12" />
                          </label>
                          <button onClick={() => removeCategory(c)} className="text-[11px] text-stone-400 hover:text-rose-600 inline-flex items-center gap-0.5">
                            <Trash2 className="w-3 h-3" /> 교과 삭제
                          </button>
                        </div>,
                        "font-medium",
                      )}
                      {span(<NumInput value={c.teachers} label="교사 수" onCommit={(teachers) => patchCat(c.id, { teachers })} className="!w-14" />, "")}

                      {addRow ? (
                        <td colSpan={7} className="px-2 py-1.5 border-r border-stone-300">
                          <button onClick={() => addSubject(c.id, "sem1")} className="w-full border border-dashed border-stone-300 rounded-lg py-1 text-xs text-stone-500 hover:border-amber-400 hover:text-amber-700">
                            + 1학기 과목
                          </button>
                        </td>
                      ) : (
                        subjectCells(c, "sem1", c.sem1[i])
                      )}
                      {span(semTotal(t.sem1Total, t.sem1TotalOriginal), "font-semibold text-stone-700")}
                      {span(t.sem1Avg, "font-semibold text-amber-700")}

                      {addRow ? (
                        <td colSpan={7} className="px-2 py-1.5 border-r border-stone-300">
                          <button onClick={() => addSubject(c.id, "sem2")} className="w-full border border-dashed border-stone-300 rounded-lg py-1 text-xs text-stone-500 hover:border-amber-400 hover:text-amber-700">
                            + 2학기 과목
                          </button>
                        </td>
                      ) : (
                        subjectCells(c, "sem2", c.sem2[i])
                      )}
                      {span(semTotal(t.sem2Total, t.sem2TotalOriginal), "font-semibold text-stone-700")}
                      {span(t.sem2Avg, "font-semibold text-amber-700")}

                      {span(t.yearTotal, "font-bold text-emerald-700")}
                      {span(t.yearAvg, "font-bold text-emerald-700")}
                    </tr>
                  );
                });
              })}
              <tr className="bg-amber-100 font-bold border-t-2 border-stone-300">
                <td colSpan={7} className="px-3 py-3 text-center border-r border-stone-300 text-amber-700">총계</td>
                <td className="px-3 py-3 text-center border-r border-stone-300 text-amber-700">{totalSem1Hours}</td>
                <td className="border-r border-stone-300" />
                <td className="px-3 py-3 text-center border-r border-stone-300 text-amber-700">{totalSem1Hours}</td>
                <td className="border-r border-stone-300" />
                <td colSpan={5} className="border-r border-stone-300" />
                <td className="px-3 py-3 text-center border-r border-stone-300 text-amber-700">{totalSem2Hours}</td>
                <td className="border-r border-stone-300" />
                <td className="px-3 py-3 text-center border-r border-stone-300 text-amber-700">{totalSem2Hours}</td>
                <td className="border-r border-stone-300" />
                <td className="px-3 py-3 text-center border-r border-stone-300 text-emerald-700 font-extrabold">{totalYear}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCategory();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="교과명 (예: 정보)"
          className="w-48 bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-800"
          aria-label="추가할 교과명"
        />
        <button type="submit" disabled={!newCat.trim()} className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-sm rounded-lg border border-stone-300 flex items-center gap-1">
          <Plus className="w-4 h-4" /> 교과 추가
        </button>
      </form>
      </>
      )}
    </div>
  );
}
