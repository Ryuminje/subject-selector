"use client";

import React, { useState } from "react";
import { Lock, Search, X } from "lucide-react";
import { sameSubject } from "../lib/subjectMatch";

interface LockedSubjectsCardProps {
  /** 이 학년 학생 데이터·시간표에 나오는 과목명 전체 */
  subjectOptions: string[];
  locked: string[];
  setLocked: (next: string[]) => void;
  gradeLabel: string;
}

/**
 * 교체 불가 과목 지정. 논술·체육+진로처럼 학급 기준으로 들어가는 과목을 골라 두면,
 * 그 과목을 듣는 학생의 그 칸은 변경되지 않는다(같은 타임의 다른 과목을 듣는 학생은 그대로 교체 가능).
 */
export function LockedSubjectsCard({ subjectOptions, locked, setLocked, gradeLabel }: LockedSubjectsCardProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const isOn = (s: string) => locked.some(l => sameSubject(l, s));
  const toggle = (s: string) => setLocked(isOn(s) ? locked.filter(l => !sameSubject(l, s)) : [...locked, s]);
  const q = query.replace(/\s+/g, "").toLowerCase();
  const shown = subjectOptions.filter(s => !q || s.replace(/\s+/g, "").toLowerCase().includes(q));

  return (
    <div className="bg-stone-100 border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
      <div className="p-4 bg-stone-200 border-b border-stone-300 flex flex-wrap items-center gap-3 justify-between">
        <h3 className="font-semibold text-stone-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700" />
          교체 불가 과목 ({gradeLabel})
          <span className="text-xs font-normal text-stone-600">
            학급 기준으로 들어가는 과목(논술, 체육 + 진로 등)을 고르면 그 과목을 듣는 학생은 바뀌지 않습니다
          </span>
        </h3>
        <button
          onClick={() => setOpen(o => !o)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-stone-300 hover:bg-amber-50 text-stone-800"
        >
          {open ? "과목 목록 닫기" : "과목 고르기"}
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {locked.length === 0 && <span className="text-sm text-stone-500">지정한 과목이 없습니다.</span>}
          {locked.map(s => (
            <span key={s} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-amber-100 border border-amber-400 text-amber-900 text-sm font-medium">
              <Lock className="w-3 h-3" />
              {s}
              <button onClick={() => toggle(s)} className="p-0.5 rounded-full hover:bg-amber-200" aria-label={`${s} 지정 해제`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        {open && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="과목 검색 (예: 논술, 체육)"
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
            <div className="max-h-56 overflow-auto flex flex-wrap gap-2 p-2 bg-white/70 border border-stone-200 rounded-lg">
              {subjectOptions.length === 0 && <span className="text-sm text-stone-500">과목 목록이 없습니다. 먼저 1단계에서 학생 데이터를 올려 주세요.</span>}
              {subjectOptions.length > 0 && shown.length === 0 && <span className="text-sm text-stone-500">검색 결과가 없습니다.</span>}
              {shown.map(s => {
                const on = isOn(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${on
                      ? "bg-amber-500 border-amber-600 text-stone-900 font-semibold"
                      : "bg-white border-stone-300 text-stone-700 hover:bg-amber-50"}`}
                  >
                    {on && <Lock className="w-3 h-3 inline mr-1" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
