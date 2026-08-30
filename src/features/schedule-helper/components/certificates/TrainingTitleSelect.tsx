"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";

interface TrainingTitleOption {
  id: string;
  title: string;
  registeredByName: string;
  category: "certificate" | "sign";
}

export default function TrainingTitleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  const [options, setOptions] = useState<TrainingTitleOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOptions = () => {
    fetch("/api/schedule-helper/certificates/training-titles")
      .then((res) => res.json())
      .then((body) =>
        setOptions((body.titles ?? []).filter((t: TrainingTitleOption) => t.category === "certificate"))
      )
      .catch(() => {});
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleToggleOpen = () => {
    if (!open) setQuery(value);
    setOpen((v) => !v);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matching = options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()));
  const isExactMatch = options.some((o) => o.title === query.trim());

  const handleSelect = (title: string) => {
    onChange(title);
    setQuery(title);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-cert/30 focus:border-cert transition-colors text-left"
      >
        <span className={value ? "text-stone-800 font-semibold" : "text-stone-400"}>
          {value || "연수명을 선택 or 입력하세요"}
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-stone-200 rounded-[10px] shadow-lg overflow-hidden">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="연수명 검색 또는 새 연수명 입력"
            className="w-full px-4 py-2.5 border-b border-stone-100 text-sm focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto divide-y divide-stone-100">
            {matching.length === 0 ? (
              <div className="px-4 py-3 text-sm text-stone-400">일치하는 연수가 없습니다.</div>
            ) : (
              matching.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleSelect(o.title)}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-cert/8 hover:text-cert transition-colors flex items-center justify-between gap-2"
                >
                  <span>{o.title}</span>
                  <span className="text-[11px] text-stone-400 shrink-0 inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> {o.registeredByName}
                  </span>
                </button>
              ))
            )}
          </div>
          {query.trim() && !isExactMatch && (
            <div className="p-2.5 border-t border-stone-100 text-center">
              <p className="text-[11px] text-stone-400">
                새 연수는 &quot;이수증 수거&quot; 탭의 &quot;새 연수&quot; 버튼으로 참여명단과 함께 등록하세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
