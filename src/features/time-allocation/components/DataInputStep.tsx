"use client";

import React from "react";
import { Database, FileDown, Trash2, Upload } from "lucide-react";
import type { TimeAllocationApi } from "../hooks/useTimeAllocation";

interface Props {
  api: TimeAllocationApi;
  onLoadFromMain: () => void;
}

const SAMPLE_URL = "/sample-time-allocation.tsv";

export function DataInputStep({ api, onLoadFromMain }: Props) {
  const { state, message } = api;
  const roster = state.roster;

  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`샘플 파일을 불러오지 못했습니다 (${res.status})`);
      api.loadSampleText(await res.text());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <Upload className="w-6 h-6 text-amber-600 shrink-0" />
        데이터 입력
      </h2>
      <p className="text-sm text-stone-600">
        본조사(수강신청) 탭에서 바로 불러오거나, 엑셀에서 헤더 2줄(학기/택N 행 + 과목명 행)과 학생 행을
        복사해 붙여넣으세요. 과목은 <b>열 위치</b>로 구분하므로 1·2학기에 같은 이름이 있어도 섞이지 않습니다.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onLoadFromMain}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Database className="w-4 h-4" /> 본조사에서 불러오기
        </button>
        <button
          onClick={loadSample}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-semibold rounded-xl transition-colors"
        >
          <FileDown className="w-4 h-4" /> 샘플 불러오기
        </button>
      </div>

      <textarea
        value={state.rawText}
        onChange={(e) => api.setRawText(e.target.value)}
        placeholder="여기에 탭으로 구분된 데이터를 붙여넣기…"
        rows={10}
        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={api.loadFromPaste}
          className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Upload className="w-4 h-4" /> 붙여넣기 불러오기
        </button>
        <button
          onClick={() => api.setRawText("")}
          className="inline-flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-200 text-sm font-semibold rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" /> 지우기
        </button>
        {message && (
          <span className={`text-sm ${message.kind === "error" ? "text-rose-600" : "text-stone-600"}`}>
            {message.text}
          </span>
        )}
      </div>

      {roster && (
        <div className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-2 bg-stone-100 text-sm text-stone-700">
            학생 <b>{roster.students.length}</b>명 · 과목 <b>{roster.subjects.length}</b>개 · 그룹{" "}
            {roster.groups.map((g) => `${g.name}(${g.cols.length})`).join(", ")}
            {state.source === "main" && " · 본조사 연동"}
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold text-stone-600">그룹</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-stone-600">과목</th>
                  <th className="px-3 py-1.5 text-right font-semibold text-stone-600">인원</th>
                </tr>
              </thead>
              <tbody>
                {roster.subjects.map((s) => (
                  <tr key={s.idx} className="border-t border-stone-100">
                    <td className="px-3 py-1 text-stone-500">{roster.groups[s.group]?.name}</td>
                    <td className="px-3 py-1">
                      {s.name}
                      {s.semester ? <span className="text-stone-400"> · {s.semester}</span> : null}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
