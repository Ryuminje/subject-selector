"use client";

import React from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { TimeAllocationApi } from "../hooks/useTimeAllocation";
import { bandList, classKeysOf } from "../lib/bands";

interface Props {
  api: TimeAllocationApi;
}

/** 반 고정 공통과목 편집표(과목명/학점/교사 수/구획/한 타임당 반/삭제). app.js renderCommonList 대응. */
export function CommonSubjectEditor({ api }: Props) {
  const { state, bandError } = api;
  const common = state.common;
  const disabled = state.confirmed;
  const bands = bandList(common);
  const nBands = Math.max(bands.length, 1);
  const classCount = state.roster ? classKeysOf(state.roster.students).length : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">
          <input
            type="checkbox"
            checked={common.on}
            disabled={disabled}
            onChange={(e) => api.setCommonOn(e.target.checked)}
          />
          반 고정 공통과목
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-stone-700">
          타임 1개 =
          <input
            type="number"
            min={1}
            max={8}
            value={common.hours}
            disabled={disabled || !common.on}
            onChange={(e) => api.setCommonHours(+e.target.value)}
            className="w-14 px-2 py-1 border border-stone-200 rounded-lg text-sm"
          />
          시수
        </label>
        <button
          onClick={api.addCommonSubject}
          disabled={disabled || !common.on}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-800 text-xs font-semibold rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> 과목 추가
        </button>
        <button
          onClick={api.packCommon}
          disabled={disabled || !common.on}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-800 text-xs font-semibold rounded-lg"
        >
          <Wand2 className="w-3.5 h-3.5" /> 구획 자동 배치
        </button>
        {bandError && <span className="text-xs text-rose-600">{bandError}</span>}
      </div>

      {common.on && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="text-stone-600">
                <th className="px-2 py-1 text-left font-semibold">과목명</th>
                <th className="px-2 py-1 font-semibold">학점</th>
                <th className="px-2 py-1 font-semibold">교사 수</th>
                <th className="px-2 py-1 font-semibold">구획</th>
                <th className="px-2 py-1 font-semibold">한 타임당 반</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {common.subjects.map((s, i) => {
                const b = bands.find((x) => x.key === s.band);
                const perTime = b ? b.perTime : 1;
                const times = classCount ? Math.ceil(classCount / perTime) : 0;
                const bad = !!b && b.credits > common.hours;
                return (
                  <tr key={i} className={bad ? "bg-rose-50" : ""}>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={s.name}
                        disabled={disabled}
                        onChange={(e) => api.updateCommonSubject(i, { name: e.target.value })}
                        className="w-32 px-2 py-1 border border-stone-200 rounded-lg"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="number"
                        min={1}
                        max={common.hours}
                        value={s.credits}
                        disabled={disabled}
                        onChange={(e) => api.updateCommonSubject(i, { credits: +e.target.value })}
                        className="w-14 px-2 py-1 border border-stone-200 rounded-lg text-center"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="number"
                        min={1}
                        value={s.teachers}
                        disabled={disabled}
                        onChange={(e) => api.updateCommonSubject(i, { teachers: +e.target.value })}
                        className="w-14 px-2 py-1 border border-stone-200 rounded-lg text-center"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <select
                        value={s.band}
                        disabled={disabled}
                        onChange={(e) => api.updateCommonSubject(i, { band: +e.target.value })}
                        className="px-2 py-1 border border-stone-200 rounded-lg"
                      >
                        {Array.from({ length: nBands + 1 }, (_, k) => (
                          <option key={k} value={k}>
                            구획 {k + 1}
                            {k >= nBands ? " (새로)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1 text-center text-stone-500">
                      {perTime}반{times ? ` · ${times}개 타임` : ""}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => api.removeCommonSubject(i)}
                        disabled={disabled}
                        className="p-1 text-stone-400 hover:text-rose-600"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-stone-500">
            구획 {bands.length}개 → 선택과목 타임 외에 {bands.length}개 타임이 더 필요합니다.{" "}
            {bands
              .map(
                (b) =>
                  `구획${b.key + 1}: ${b.subjects.map((x) => x.credits).join("+")}=${b.credits}/${common.hours}시수`,
              )
              .join(" , ")}
          </p>
        </div>
      )}
    </div>
  );
}
