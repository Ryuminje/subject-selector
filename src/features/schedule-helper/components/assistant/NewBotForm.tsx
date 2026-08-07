"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ACCENTS } from "@/features/schedule-helper/lib/assistant/config";
import { accentStyle } from "./accents";

const SWATCH_COLORS: Record<string, string> = {
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
};

// 새 챗봇 만들기. 여기서는 이름만 정하고, 자료는 만든 뒤 설정 화면에서 올립니다 —
// 한 화면에 다 넣으면 "무엇부터 해야 하는지"가 흐려집니다.

export default function NewBotForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: { name: string; tagline: string; emoji: string; accent: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [accent, setAccent] = useState<string>("amber");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style = accentStyle(accent);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await onCreate({ name: name.trim(), tagline: tagline.trim(), emoji, accent });
    setBusy(false);
    if (!result.ok) setError(result.error ?? "챗봇을 만들지 못했습니다.");
  };

  return (
    <form onSubmit={submit} className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-amber-700 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 목록으로
      </button>

      <h2 className="text-lg font-bold text-stone-900">새 챗봇 만들기</h2>
      <p className="mt-1 text-sm text-stone-500 leading-relaxed">
        업무 하나에 챗봇 하나를 권합니다. 자료가 섞이지 않아야 답이 정확해집니다.
      </p>

      <div className="mt-5 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="챗봇 이름 (예: 학적 파트너)"
          autoFocus
          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        />
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="한 줄 소개 (선택)"
          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="flex items-center gap-3 mt-4">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          className={`w-12 h-12 shrink-0 text-center text-xl rounded-xl outline-none ${style.avatar}`}
          aria-label="아바타 이모지"
        />
        <div className="flex gap-2">
          {ACCENTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAccent(value)}
              aria-label={value}
              className={`w-8 h-8 rounded-lg border-2 transition-colors ${SWATCH_COLORS[value]} ${
                accent === value ? "border-stone-800" : "border-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="w-full mt-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {busy ? "만드는 중…" : "만들고 자료 올리기"}
      </button>
    </form>
  );
}
