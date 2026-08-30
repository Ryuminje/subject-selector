"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

export default function GeminiKeySettings() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/schedule-helper/certificates/gemini-key")
      .then((res) => res.json())
      .then((body) => setConfigured(!!body.configured))
      .catch(() => setConfigured(false));
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/schedule-helper/certificates/gemini-key", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "저장에 실패했습니다.");
      return;
    }
    setApiKey("");
    setExpanded(false);
    setConfigured(true);
  };

  return (
    <div className="bg-white rounded-[14px] border border-stone-200 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-cert flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Gemini API 키 설정
        </h2>
        {configured && !expanded && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" /> 설정됨
          </span>
        )}
      </div>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        이수증 이미지에서 정보를 자동 추출하는 데 사용됩니다. 한 번 등록하면 우리 학교 전체 선생님이 사용할 수 있습니다.
      </p>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-600 hover:bg-stone-500 text-white text-sm font-semibold rounded-[10px] transition-colors"
        >
          {configured ? "키 다시 설정하기" : "API 키 등록하기"}
        </button>
      ) : (
        <div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-cert font-semibold hover:underline mb-3"
          >
            구글 AI 스튜디오에서 무료로 발급받기 <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... 로 시작하는 API 키를 붙여넣으세요"
              className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-cert/30 focus:border-cert transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-cert hover:opacity-90 disabled:opacity-60 text-white font-bold rounded-[10px] transition-opacity shrink-0"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              저장
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
