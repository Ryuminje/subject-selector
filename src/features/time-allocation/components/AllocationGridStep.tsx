"use client";

import React, { useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles, Wand2, XCircle } from "lucide-react";
import type { TimeAllocationApi } from "../hooks/useTimeAllocation";
import { CommonSubjectEditor } from "./CommonSubjectEditor";
import { classesAt, commonCells } from "../lib/gridModel";
import { classKey, classLabel } from "../lib/bands";
import { timeLabel } from "../lib/studentRows";
import { countAt, sectionLabel, splitSectionStudents } from "../lib/assign";
import { NO_SEMESTER_KEY, semesterKeyOf } from "../types";

interface Props {
  api: TimeAllocationApi;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const GROUP_TINT = ["bg-amber-50", "bg-sky-50", "bg-violet-50"];

export function AllocationGridStep({ api }: Props) {
  const { state, ctx, assign, numTimes, perTime, message, semesterKeys } = api;
  const roster = state.roster;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const settingsKey = activeKey && semesterKeys.includes(activeKey) ? activeKey : semesterKeys[0];

  if (!roster || !ctx || !settingsKey) {
    return <p className="text-sm text-stone-500 py-8">먼저 ① 데이터 입력에서 자료를 불러오세요.</p>;
  }

  const subs = roster.subjects;
  const groups = roster.groups;
  const com = commonCells(ctx.bySemester);
  const N = roster.students.length;
  const dis = state.confirmed;
  const settings = api.settingsOf(settingsKey);

  const studentsOf = (keys: string[]) =>
    roster.students.filter((st) => keys.includes(classKey(st.id))).length;

  const asg = subs.map(() => 0);
  const un = subs.map(() => 0);
  let asgTot = 0;
  let unTot = 0;
  let unStu = 0;
  let fullStu = 0;
  if (assign) {
    assign.byStudent.forEach((m) => {
      for (const s of m.keys()) asg[s]++;
      asgTot += m.size;
    });
    assign.unassigned.forEach((u) => {
      u.forEach((s) => un[s]++);
      unTot += u.length;
      if (u.length) unStu++;
      else fullStu++;
    });
  }

  // 학기가 여럿이면 열 순서를 학기별로 묶습니다 — 그 학기의 과목 그룹들 바로 다음에 그
  // 학기의 반 고정 공통과목을 붙여서(예: … C·1학기 → 반고정공통(1학기) → B·2학기 …),
  // 반 고정 공통과목 전부가 맨 끝에 뭉뚱그려 붙어 어느 학기 것인지 헷갈리는 문제를 없앱니다.
  // 학기가 하나뿐이면(또는 없으면) 구분할 의미가 없어 기존처럼 그냥 맨 끝에 한 덩어리로 둡니다.
  const groupSemesterKey = (g: (typeof groups)[number]) =>
    g.cols.length ? semesterKeyOf(subs[g.cols[0]]) : NO_SEMESTER_KEY;

  type SubjectHeaderGroup = { kind: "subject"; gi: number; name: string; cols: number[] };
  type CommonHeaderGroup = { kind: "common"; semesterKey: string; items: { cell: (typeof com)[number]; ci: number }[] };
  const headerGroups: (SubjectHeaderGroup | CommonHeaderGroup)[] = [];

  if (semesterKeys.length > 1) {
    semesterKeys.forEach((key) => {
      groups.forEach((g, gi) => {
        if (groupSemesterKey(g) === key) headerGroups.push({ kind: "subject", gi, name: g.name, cols: g.cols });
      });
      const items = com.map((cell, ci) => ({ cell, ci })).filter(({ cell }) => cell.semesterKey === key);
      if (items.length) headerGroups.push({ kind: "common", semesterKey: key, items });
    });
  } else {
    groups.forEach((g, gi) => headerGroups.push({ kind: "subject", gi, name: g.name, cols: g.cols }));
    if (com.length) {
      headerGroups.push({ kind: "common", semesterKey: com[0]?.semesterKey ?? "", items: com.map((cell, ci) => ({ cell, ci })) });
    }
  }

  type OrderedColumn = { kind: "subject"; idx: number } | { kind: "common"; cell: (typeof com)[number]; ci: number };
  const orderedColumns: OrderedColumn[] = headerGroups.flatMap((hg): OrderedColumn[] =>
    hg.kind === "subject"
      ? hg.cols.map((idx): OrderedColumn => ({ kind: "subject", idx }))
      : hg.items.map(({ cell, ci }): OrderedColumn => ({ kind: "common", cell, ci }))
  );

  const isGroupAllSelected = (cols: number[]) => cols.every((s) => state.selected[s]);
  const allSubjectsSelected = subs.length > 0 && subs.every((s) => state.selected[s.idx]);
  const toggleAllGroups = (on: boolean) => groups.forEach((_, gi) => api.toggleGroup(gi, on));

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <Wand2 className="w-6 h-6 text-amber-600 shrink-0" />
        타임 배정
      </h2>

      {semesterKeys.length > 1 && (
        <div className="flex gap-2">
          {semesterKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveKey(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                key === settingsKey ? "bg-amber-500 text-white shadow" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {key === NO_SEMESTER_KEY ? "설정" : key} 설정
            </button>
          ))}
          <span className="text-xs text-stone-400 self-center">
            학기마다 정원·타임 수·공통과목을 따로 설정합니다(서로 영향 없음).
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5">
          학급당
          <input
            type="number"
            min={1}
            value={settings.cap}
            disabled={dis}
            onChange={(e) => api.setCap(settingsKey, +e.target.value)}
            className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center"
          />
          명
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={settings.allowOver}
            disabled={dis}
            onChange={(e) => api.setAllowOver(settingsKey, e.target.checked)}
          />
          인원초과 허용
        </label>
        <label className="inline-flex items-center gap-1.5">
          시작
          <select
            value={state.startLetter}
            disabled={dis}
            onChange={(e) => api.setStartLetter(+e.target.value)}
            className="px-2 py-1 border border-stone-200 rounded-lg"
          >
            {LETTERS.map((c, i) => (
              <option key={c} value={i}>
                {c}
              </option>
            ))}
          </select>
          부터
        </label>
        <label className="inline-flex items-center gap-1.5">
          선택과목 타임 수
          <input
            type="number"
            min={1}
            value={settings.numElectiveTimes}
            disabled={dis}
            onChange={(e) => api.setNumElectiveTimes(settingsKey, +e.target.value)}
            className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center"
          />
          <span className="text-stone-400">(+구획 → 전체 {numTimes}타임, 학기 중 최대치 기준)</span>
        </label>
      </div>

      <CommonSubjectEditor api={api} semesterKey={settingsKey} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={api.runOptimize}
          disabled={dis}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl"
        >
          <Sparkles className="w-4 h-4" /> ① 배정 최적화
        </button>
        {!state.confirmed ? (
          <button
            onClick={() => api.setConfirmed(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-sm font-semibold rounded-xl"
          >
            <CheckCircle2 className="w-4 h-4" /> ② 확정
          </button>
        ) : (
          <button
            onClick={() => api.setConfirmed(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-semibold rounded-xl"
          >
            <XCircle className="w-4 h-4" /> 확정취소
          </button>
        )}
        <button
          onClick={api.resetPlacement}
          disabled={dis}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-stone-600 hover:bg-stone-200 disabled:opacity-40 text-sm font-semibold rounded-xl"
        >
          <RotateCcw className="w-4 h-4" /> 초기화
        </button>
        {message && (
          <span className={`text-sm ${message.kind === "error" ? "text-rose-600" : "text-stone-600"}`}>
            {message.text}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-stone-500">
          셀을 클릭하면 그 타임에 분반을 추가/제거합니다(수동 조정). 조정하면 자동으로 다시 배정됩니다.
        </p>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
          <input
            type="checkbox"
            checked={allSubjectsSelected}
            disabled={dis}
            onChange={(e) => toggleAllGroups(e.target.checked)}
          />
          전체 선택
        </label>
      </div>

      <div className="overflow-auto border border-stone-200 rounded-xl">
        <table className="text-[11px] border-collapse whitespace-nowrap">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-stone-100 border border-stone-200 px-2 py-1" rowSpan={2}>
                타임<br />(이수과목)
              </th>
              <th className="bg-stone-100 border border-stone-200 px-2 py-1" rowSpan={2}>
                인원(반)<br />학생 {N}명
              </th>
              {headerGroups.map((hg, hgi) =>
                hg.kind === "subject" ? (
                  <th
                    key={`g-${hg.gi}`}
                    className={`border border-stone-200 px-2 py-1 ${GROUP_TINT[hg.gi % 3]}`}
                    colSpan={hg.cols.length}
                  >
                    <label className="inline-flex items-center gap-1">
                      {hg.name}
                      <input
                        type="checkbox"
                        checked={isGroupAllSelected(hg.cols)}
                        disabled={dis}
                        onChange={(e) => api.toggleGroup(hg.gi, e.target.checked)}
                      />
                    </label>
                  </th>
                ) : (
                  <th key={`com-${hgi}`} className="border border-stone-200 px-2 py-1 bg-emerald-50" colSpan={hg.items.length}>
                    반 고정 공통{semesterKeys.length > 1 ? ` (${hg.semesterKey})` : ""}
                  </th>
                )
              )}
            </tr>
            <tr>
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <th
                    key={`s-${col.idx}`}
                    className={`border border-stone-200 px-2 py-1 font-medium ${state.selected[col.idx] ? "" : "text-stone-300"}`}
                  >
                    {subs[col.idx].name}
                  </th>
                ) : (
                  <th key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 font-medium bg-emerald-50/60">
                    {col.cell.name}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-stone-50 font-semibold">
              <td className="sticky left-0 bg-stone-50 border border-stone-200 px-2 py-1">전체합계</td>
              <td className="border border-stone-200 px-2 py-1 text-center">{N}</td>
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <td key={`s-${col.idx}`} className="border border-stone-200 px-2 py-1 text-center tabular-nums">
                    {subs[col.idx].count}
                  </td>
                ) : (
                  <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center">
                    {N}
                  </td>
                )
              )}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">분반 설정</td>
              <td className="border border-stone-200" />
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <td key={`s-${col.idx}`} className="border border-stone-200 px-1 py-1 text-center">
                    <input
                      type="number"
                      min={0}
                      title="타임 수보다 많이 넣으면 남는 분반은 가장 한산한 타임에 겹쳐 열립니다(A1/A2로 표시)."
                      value={state.sections[col.idx] ?? 0}
                      disabled={dis || !state.selected[col.idx]}
                      onChange={(e) => api.setSection(col.idx, +e.target.value)}
                      className="w-12 px-1 py-0.5 border border-stone-200 rounded text-center"
                    />
                  </td>
                ) : (
                  <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                    구획{col.cell.bandIdx + 1}·{col.cell.credits}학점
                  </td>
                )
              )}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">배정과목 선택</td>
              <td className="border border-stone-200" />
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <td key={`s-${col.idx}`} className="border border-stone-200 px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={state.selected[col.idx]}
                      disabled={dis}
                      onChange={() => api.toggleSelected(col.idx)}
                    />
                  </td>
                ) : (
                  <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                    반 고정
                  </td>
                )
              )}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">
                인원설정 고정
                <span className="block text-[10px] text-stone-400">체크 시 정원 강제</span>
              </td>
              <td className="border border-stone-200" />
              {orderedColumns.map((col) => {
                if (col.kind === "common") {
                  return (
                    <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                      고정
                    </td>
                  );
                }
                const fixed = col.idx in state.fixedCap;
                return (
                  <td key={`s-${col.idx}`} className="border border-stone-200 px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={fixed}
                      disabled={dis || !state.selected[col.idx]}
                      onChange={() => api.toggleFixedCap(col.idx)}
                    />
                    {fixed && (
                      <input
                        type="number"
                        min={1}
                        value={state.fixedCap[col.idx]}
                        disabled={dis}
                        onChange={(e) => api.setFixedCap(col.idx, +e.target.value)}
                        className="mt-0.5 w-12 px-1 py-0.5 border border-amber-300 rounded text-center block mx-auto"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
            {Array.from({ length: numTimes }, (_, t) => {
              const row = perTime[t];
              return (
                <tr key={t}>
                  <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1 font-medium">
                    {timeLabel({ startLetter: state.startLetter }, t)}타임
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-center tabular-nums">
                    {row ? `${row.students}(${row.sections})` : ""}
                  </td>
                  {orderedColumns.map((col) => {
                    if (col.kind === "common") {
                      const c = col.cell;
                      const bandTimes = ctx.bySemester[c.semesterKey]?.bandTimes ?? [];
                      const ks = classesAt({ students: roster.students }, bandTimes, c.bandIdx, t);
                      if (!ks.length) return <td key={`c-${col.ci}`} className="border border-stone-200 bg-stone-50/50" />;
                      return (
                        <td
                          key={`c-${col.ci}`}
                          className={`border border-stone-200 px-2 py-1 text-center ${c.shared ? "bg-emerald-50/40 text-stone-400" : "bg-emerald-50"}`}
                        >
                          {studentsOf(ks)}
                          <span className="block text-[10px] text-stone-500">
                            {ks.map(classLabel).join(",")}
                          </span>
                        </td>
                      );
                    }
                    const i = col.idx;
                    const s = subs[i];
                    if (!state.selected[i])
                      return <td key={`s-${i}`} className="border border-stone-200 bg-stone-50/50" />;
                    const count = countAt(state.placement[i] ?? [], t);
                    if (count === 0) {
                      return (
                        <td
                          key={`s-${i}`}
                          onClick={() => !dis && api.toggleCell(i, t, "add")}
                          className="border border-stone-200 px-2 py-1 text-center text-stone-200 hover:bg-amber-50 cursor-pointer"
                        >
                          +
                        </td>
                      );
                    }
                    const cap = state.fixedCap[i] ?? ctx.bySemester[semesterKeyOf(s)]?.cap ?? 29;
                    // 분반이 겹친 칸(count>1)은 실제 배정 인원을 분반별로 나눠 "A1"/"A2" 로
                    // 구분해 보여줍니다 — 합계만 보이면 어느 학생이 어느 교실인지 알 수 없습니다.
                    const groups = assign
                      ? splitSectionStudents(ctx, state.placement, assign, i, t)
                      : Array.from({ length: count }, () => []);
                    const base = timeLabel({ startLetter: state.startLetter }, t);
                    return (
                      <td key={`s-${i}`} className="border border-stone-200 px-1 py-1 text-center tabular-nums">
                        {groups.map((g, gi) => {
                          const n = g.length;
                          const tone = n > cap ? "text-rose-700" : n === cap ? "text-amber-700" : "";
                          return (
                            <div
                              key={gi}
                              onClick={() => !dis && api.toggleCell(i, t, "remove")}
                              className={`cursor-pointer hover:bg-amber-50 ${tone}`}
                            >
                              {count > 1 ? `${sectionLabel(base, gi + 1, count)} ` : ""}
                              {n}
                            </div>
                          );
                        })}
                        {!dis && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              api.toggleCell(i, t, "add");
                            }}
                            title="이 타임에 분반 하나 더 겹쳐 열기"
                            className="text-[10px] text-emerald-600 hover:underline"
                          >
                            ＋분반
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-stone-50">
              <td className="sticky left-0 bg-stone-50 border border-stone-200 px-2 py-1">배정(명)</td>
              <td className="border border-stone-200 px-2 py-1 text-center">
                {asgTot}({fullStu})
              </td>
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <td key={`s-${col.idx}`} className="border border-stone-200 px-2 py-1 text-center tabular-nums">
                    {state.selected[col.idx] ? asg[col.idx] : ""}
                  </td>
                ) : (
                  <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center">
                    {N}
                  </td>
                )
              )}
            </tr>
            <tr className="bg-stone-50">
              <td className="sticky left-0 bg-stone-50 border border-stone-200 px-2 py-1">미배정(명)</td>
              <td className="border border-stone-200 px-2 py-1 text-center text-rose-600">
                {unTot}({unStu})
              </td>
              {orderedColumns.map((col) =>
                col.kind === "subject" ? (
                  <td
                    key={`s-${col.idx}`}
                    className={`border border-stone-200 px-2 py-1 text-center tabular-nums ${un[col.idx] ? "text-rose-600" : ""}`}
                  >
                    {state.selected[col.idx] ? un[col.idx] : ""}
                  </td>
                ) : (
                  <td key={`c-${col.ci}`} className="border border-stone-200 px-2 py-1 text-center">
                    0
                  </td>
                )
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
