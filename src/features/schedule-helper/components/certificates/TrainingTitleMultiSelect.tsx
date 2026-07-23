"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useTrainingTitles } from "./useTrainingTitles";

export default function TrainingTitleMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (titles: string[]) => void;
}) {
  const { titles } = useTrainingTitles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = (titles ?? []).filter((t) => t.category === "sign");
  const matching = options.filter(
    (o) => !value.includes(o.title) && o.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleAdd = (title: string) => {
    onChange([...value, title]);
    setQuery("");
    setOpen(false);
  };

  const handleRemove = (title: string) => {
    onChange(value.filter((t) => t !== title));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[42px] flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-text focus-within:ring-2 focus-within:ring-teal-500/50 focus-within:border-teal-500 transition-all"
      >
        {value.map((title) => (
          <span
            key={title}
            className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold"
          >
            {title}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(title);
              }}
              className="hover:bg-teal-200 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? "연수를 선택하세요" : ""}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
        />
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {matching.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                {options.length === 0
                  ? "등록된 연수가 없습니다. \"연수목록 관리 → 서명 연수 관리\"에서 먼저 등록하세요."
                  : "일치하는 연수가 없습니다."}
              </div>
            ) : (
              matching.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleAdd(o.title)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                >
                  {o.title}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
