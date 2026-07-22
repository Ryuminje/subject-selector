"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, PlusCircle, Loader2, UserCheck } from "lucide-react";

interface TrainingTitleOption {
  id: string;
  title: string;
  registeredByName: string;
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
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOptions = () => {
    fetch("/api/schedule-helper/certificates/training-titles")
      .then((res) => res.json())
      .then((body) => setOptions(body.titles ?? []))
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

  const handleRegister = async () => {
    const title = query.trim();
    if (!title) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule-helper/certificates/training-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "등록 중 오류가 발생했습니다.");
        return;
      }
      loadOptions();
      handleSelect(title);
    } catch {
      setError("등록 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-left"
      >
        <span className={value ? "text-slate-800 font-semibold" : "text-slate-400"}>
          {value || "연수명을 선택 or 입력하세요"}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="연수명 검색 또는 새 연수명 입력"
            className="w-full px-4 py-2.5 border-b border-slate-100 text-sm focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {matching.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">일치하는 연수가 없습니다.</div>
            ) : (
              matching.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleSelect(o.title)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors flex items-center justify-between gap-2"
                >
                  <span>{o.title}</span>
                  <span className="text-[11px] text-slate-400 shrink-0 inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> {o.registeredByName}
                  </span>
                </button>
              ))
            )}
          </div>
          {query.trim() && !isExactMatch && (
            <div className="p-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                &quot;{query.trim()}&quot; 새 연수로 등록
              </button>
              {error && <p className="text-[11px] text-rose-600 mt-1.5 text-center">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
