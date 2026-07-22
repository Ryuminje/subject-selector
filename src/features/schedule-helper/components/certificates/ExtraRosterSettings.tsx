"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, X } from "lucide-react";

interface ExtraEntry {
  id: string;
  name: string;
  addedBy: string;
}

export default function ExtraRosterSettings() {
  const [entries, setEntries] = useState<ExtraEntry[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/schedule-helper/certificates/extra-roster")
      .then((res) => res.json())
      .then((body) => setEntries(body.entries ?? []))
      .catch(() => {});
  }, []);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/schedule-helper/certificates/extra-roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setAdding(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "추가에 실패했습니다.");
      return;
    }
    const body = await res.json();
    setEntries((prev) => [body.entry, ...prev]);
    setName("");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/schedule-helper/certificates/extra-roster/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> 명단에 없는 인원 추가
        </h2>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            관리하기
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        시간표에 등장하지 않는 직원(행정실, 교장/교감 등)을 일괄확인·QR 서명 명단에만 추가로 포함시킵니다. 시간표
        교체 도우미에는 영향을 주지 않습니다.
      </p>

      {expanded && (
        <div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="이름을 입력하세요"
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              추가
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

          {entries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entries.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold"
                >
                  {e.name}
                  <button
                    onClick={() => handleDelete(e.id)}
                    title="삭제"
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
