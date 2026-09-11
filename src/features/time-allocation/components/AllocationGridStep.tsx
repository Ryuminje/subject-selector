"use client";

import React from "react";
import { CheckCircle2, RotateCcw, Sparkles, Wand2, XCircle } from "lucide-react";
import type { TimeAllocationApi } from "../hooks/useTimeAllocation";
import { CommonSubjectEditor } from "./CommonSubjectEditor";
import { classesAt, commonCells } from "../lib/gridModel";
import { classKey, classLabel } from "../lib/bands";
import { timeLabel } from "../lib/studentRows";

interface Props {
  api: TimeAllocationApi;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const GROUP_TINT = ["bg-amber-50", "bg-sky-50", "bg-violet-50"];

export function AllocationGridStep({ api }: Props) {
  const { state, ctx, assign, numTimes, perTime, message } = api;
  const roster = state.roster;

  if (!roster || !ctx) {
    return <p className="text-sm text-stone-500 py-8">먼저 ① 데이터 입력에서 자료를 불러오세요.</p>;
  }

  const subs = roster.subjects;
  const groups = roster.groups;
  const com = commonCells(state.common);
  const N = roster.students.length;
  const dis = state.confirmed;

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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <Wand2 className="w-6 h-6 text-amber-600 shrink-0" />
        타임 배정
      </h2>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5">
          학급당
          <input
            type="number"
            min={1}
            value={state.cap}
            disabled={dis}
            onChange={(e) => api.setCap(+e.target.value)}
            className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center"
          />
          명
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={state.allowOver}
            disabled={dis}
            onChange={(e) => api.setAllowOver(e.target.checked)}
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
            value={state.numElectiveTimes}
            disabled={dis}
            onChange={(e) => api.setNumElectiveTimes(+e.target.value)}
            className="w-16 px-2 py-1 border border-stone-200 rounded-lg text-center"
          />
          <span className="text-stone-400">(+구획 → 전체 {numTimes}타임)</span>
        </label>
      </div>

      <CommonSubjectEditor api={api} />

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

      <p className="text-xs text-stone-500">
        셀을 클릭하면 그 타임에 분반을 추가/제거합니다(수동 조정). 조정하면 자동으로 다시 배정됩니다.
      </p>

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
              {groups.map((g, gi) => {
                const all = g.cols.every((s) => state.selected[s]);
                return (
                  <th
                    key={gi}
                    className={`border border-stone-200 px-2 py-1 ${GROUP_TINT[gi % 3]}`}
                    colSpan={g.cols.length}
                  >
                    <label className="inline-flex items-center gap-1">
                      {g.name}
                      <input
                        type="checkbox"
                        checked={all}
                        disabled={dis}
                        onChange={(e) => api.toggleGroup(gi, e.target.checked)}
                      />
                    </label>
                  </th>
                );
              })}
              {com.length > 0 && (
                <th className="border border-stone-200 px-2 py-1 bg-emerald-50" colSpan={com.length}>
                  반 고정 공통
                </th>
              )}
            </tr>
            <tr>
              {subs.map((s) => (
                <th
                  key={s.idx}
                  className={`border border-stone-200 px-2 py-1 font-medium ${state.selected[s.idx] ? "" : "text-stone-300"}`}
                >
                  {s.name}
                </th>
              ))}
              {com.map((c, i) => (
                <th key={i} className="border border-stone-200 px-2 py-1 font-medium bg-emerald-50/60">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-stone-50 font-semibold">
              <td className="sticky left-0 bg-stone-50 border border-stone-200 px-2 py-1">전체합계</td>
              <td className="border border-stone-200 px-2 py-1 text-center">{N}</td>
              {subs.map((s) => (
                <td key={s.idx} className="border border-stone-200 px-2 py-1 text-center tabular-nums">
                  {s.count}
                </td>
              ))}
              {com.map((_, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center">
                  {N}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">분반 설정</td>
              <td className="border border-stone-200" />
              {subs.map((s) => (
                <td key={s.idx} className="border border-stone-200 px-1 py-1 text-center">
                  <input
                    type="number"
                    min={0}
                    max={numTimes}
                    value={state.sections[s.idx] ?? 0}
                    disabled={dis || !state.selected[s.idx]}
                    onChange={(e) => api.setSection(s.idx, +e.target.value)}
                    className="w-12 px-1 py-0.5 border border-stone-200 rounded text-center"
                  />
                </td>
              ))}
              {com.map((c, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                  구획{c.bandIdx + 1}·{c.credits}학점
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">배정과목 선택</td>
              <td className="border border-stone-200" />
              {subs.map((s) => (
                <td key={s.idx} className="border border-stone-200 px-1 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={state.selected[s.idx]}
                    disabled={dis}
                    onChange={() => api.toggleSelected(s.idx)}
                  />
                </td>
              ))}
              {com.map((_, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                  반 고정
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 bg-white border border-stone-200 px-2 py-1">
                인원설정 고정
                <span className="block text-[10px] text-stone-400">체크 시 정원 강제</span>
              </td>
              <td className="border border-stone-200" />
              {subs.map((s) => {
                const fixed = s.idx in state.fixedCap;
                return (
                  <td key={s.idx} className="border border-stone-200 px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={fixed}
                      disabled={dis || !state.selected[s.idx]}
                      onChange={() => api.toggleFixedCap(s.idx)}
                    />
                    {fixed && (
                      <input
                        type="number"
                        min={1}
                        value={state.fixedCap[s.idx]}
                        disabled={dis}
                        onChange={(e) => api.setFixedCap(s.idx, +e.target.value)}
                        className="mt-0.5 w-12 px-1 py-0.5 border border-amber-300 rounded text-center block mx-auto"
                      />
                    )}
                  </td>
                );
              })}
              {com.map((_, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center text-stone-400">
                  고정
                </td>
              ))}
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
                  {subs.map((s) => {
                    const i = s.idx;
                    if (!state.selected[i])
                      return <td key={i} className="border border-stone-200 bg-stone-50/50" />;
                    const has = state.placement[i]?.includes(t);
                    if (!has) {
                      return (
                        <td
                          key={i}
                          onClick={() => !dis && api.toggleCell(i, t)}
                          className="border border-stone-200 px-2 py-1 text-center text-stone-200 hover:bg-amber-50 cursor-pointer"
                        >
                          +
                        </td>
                      );
                    }
                    const n = assign ? assign.load[i][t] : 0;
                    const cap = state.fixedCap[i] ?? state.cap;
                    const tone =
                      n > cap ? "bg-rose-100 text-rose-700" : n === cap ? "bg-amber-100" : "bg-emerald-50";
                    return (
                      <td
                        key={i}
                        onClick={() => !dis && api.toggleCell(i, t)}
                        className={`border border-stone-200 px-2 py-1 text-center tabular-nums cursor-pointer ${tone}`}
                      >
                        {n}
                      </td>
                    );
                  })}
                  {com.map((c, ci) => {
                    const ks = classesAt(
                      { students: roster.students, bandTimes: ctx.bandTimes },
                      c.bandIdx,
                      t,
                    );
                    if (!ks.length) return <td key={ci} className="border border-stone-200 bg-stone-50/50" />;
                    return (
                      <td
                        key={ci}
                        className={`border border-stone-200 px-2 py-1 text-center ${c.shared ? "bg-emerald-50/40 text-stone-400" : "bg-emerald-50"}`}
                      >
                        {studentsOf(ks)}
                        <span className="block text-[10px] text-stone-500">
                          {ks.map(classLabel).join(",")}
                        </span>
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
              {subs.map((s) => (
                <td key={s.idx} className="border border-stone-200 px-2 py-1 text-center tabular-nums">
                  {state.selected[s.idx] ? asg[s.idx] : ""}
                </td>
              ))}
              {com.map((_, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center">
                  {N}
                </td>
              ))}
            </tr>
            <tr className="bg-stone-50">
              <td className="sticky left-0 bg-stone-50 border border-stone-200 px-2 py-1">미배정(명)</td>
              <td className="border border-stone-200 px-2 py-1 text-center text-rose-600">
                {unTot}({unStu})
              </td>
              {subs.map((s) => (
                <td
                  key={s.idx}
                  className={`border border-stone-200 px-2 py-1 text-center tabular-nums ${un[s.idx] ? "text-rose-600" : ""}`}
                >
                  {state.selected[s.idx] ? un[s.idx] : ""}
                </td>
              ))}
              {com.map((_, i) => (
                <td key={i} className="border border-stone-200 px-2 py-1 text-center">
                  0
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
