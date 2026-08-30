"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileUp, Loader2, Plus, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { ACCENTS } from "@/features/schedule-helper/lib/assistant/config";
import { accentStyle } from "./accents";
import type { BotDetail, DocumentItem } from "./types";

// 챗봇 설정 + 자료함.
//
// 자료 분석은 서버가 한 번에 끝내지 않고 조금씩 진행하므로, 화면이 /ingest를 반복 호출하며
// 진행률을 갱신합니다. 그래서 "몇 % 진행 중"과 "왜 실패했는지"가 그대로 보입니다.

const SWATCH_COLORS: Record<string, string> = {
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function statusPill(doc: DocumentItem) {
  if (doc.status === "ready") return { label: "완료", className: "bg-emerald-50 text-emerald-700" };
  if (doc.status === "failed") return { label: "실패", className: "bg-rose-50 text-rose-700" };
  return { label: "분석 중", className: "bg-amber-100 text-amber-800" };
}

export default function BotSettingsPanel({
  botId,
  onBack,
  onChanged,
  onDeleted,
}: {
  botId: string;
  onBack: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [bot, setBot] = useState<BotDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    return fetch(`/api/schedule-helper/assistant/bots/${botId}`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) {
          setError(body.error);
          return;
        }
        setBot({ ...body.bot, starters: body.bot.starters ?? [] });
        setDocuments(body.documents ?? []);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [botId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (changes: Partial<BotDetail>) => setBot((prev) => (prev ? { ...prev, ...changes } : prev));

  const save = async () => {
    if (!bot) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schedule-helper/assistant/bots/${botId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bot.name,
        tagline: bot.tagline ?? "",
        emoji: bot.emoji,
        accent: bot.accent,
        persona: bot.persona ?? "",
        starters: bot.starters,
      }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(body?.error ?? "저장하지 못했습니다.");
      return;
    }
    setSaved(true);
    onChanged();
    window.setTimeout(() => setSaved(false), 1800);
  };

  /** 자료 하나를 끝까지(ready/failed) 분석시키며 진행률을 갱신합니다. */
  const runIngest = useCallback(async (docId: string, retry = false) => {
    setNotice(null);
    // 안전 상한 — 서버가 한 번에 조각 60개씩 처리하므로 이 정도면 아주 큰 문서도 덮습니다.
    for (let i = 0; i < 200; i++) {
      // retry는 첫 호출에만 붙입니다(그 다음부터는 이미 processing 상태라 불필요).
      const query = retry && i === 0 ? "?retry=1" : "";
      const res = await fetch(`/api/schedule-helper/assistant/documents/${docId}/ingest${query}`, {
        method: "POST",
      });
      const progress = await res.json().catch(() => null);
      if (!res.ok || !progress) {
        setError(progress?.error ?? "자료를 분석하지 못했습니다.");
        return;
      }
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, ...progress } : d)));

      // 속도 제한에 걸리면 서버가 실패로 못 박지 않고 얼마나 쉬면 되는지 알려줍니다.
      if (progress.waitMs) {
        setNotice(progress.notice ?? "잠시 쉬는 중입니다.");
        await new Promise((resolve) => setTimeout(resolve, progress.waitMs));
        continue;
      }

      if (progress.status === "ready" || progress.status === "failed") break;
    }
    setNotice(null);
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`/api/schedule-helper/assistant/bots/${botId}/documents`, {
      method: "POST",
      body: form,
    });
    const body = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) {
      setError(body?.error ?? "업로드하지 못했습니다.");
      return;
    }
    await load();
    await runIngest(body.id);
    onChanged();
  };

  const removeDocument = async (docId: string) => {
    if (!window.confirm("이 자료를 삭제할까요? 삭제하면 답변에서 더 이상 참고하지 않습니다.")) return;
    await fetch(`/api/schedule-helper/assistant/documents/${docId}`, { method: "DELETE" });
    await load();
    onChanged();
  };

  const removeBot = async () => {
    if (!bot) return;
    if (!window.confirm(`"${bot.name}" 챗봇을 삭제할까요? 올린 자료와 대화가 모두 사라집니다.`)) return;
    const res = await fetch(`/api/schedule-helper/assistant/bots/${botId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-assist">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!bot) {
    return <p className="py-20 text-center text-sm text-stone-400">{error ?? "챗봇을 찾을 수 없습니다."}</p>;
  }

  const style = accentStyle(bot.accent);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-assist transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 대화로 돌아가기
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3.5 py-1.5 bg-assist hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-opacity"
        >
          {saving ? "저장 중…" : saved ? "저장됨" : "저장"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-[10px] px-3 py-2">{error}</p>}
      {notice && (
        <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          {notice}
        </p>
      )}

      {/* 기본 정보 */}
      <section className="bg-white border border-stone-200 rounded-[10px] p-4">
        <h3 className="text-[11px] font-bold tracking-wider text-stone-400 mb-3">기본 정보</h3>
        <input
          value={bot.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="챗봇 이름"
          className="w-full bg-stone-50 border border-stone-200 rounded-[10px] px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-assist/30"
        />
        <input
          value={bot.tagline ?? ""}
          onChange={(e) => patch({ tagline: e.target.value })}
          placeholder="한 줄 소개 (예: 기재요령 기반 질의응답)"
          className="w-full bg-stone-50 border border-stone-200 rounded-[10px] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-assist/30"
        />

        <div className="flex items-center gap-3 mt-3">
          <input
            value={bot.emoji}
            onChange={(e) => patch({ emoji: e.target.value.slice(0, 2) })}
            className={`w-11 h-11 shrink-0 text-center text-lg rounded-[10px] outline-none ${style.avatar}`}
            aria-label="아바타 이모지"
          />
          <div className="flex gap-2">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                onClick={() => patch({ accent })}
                aria-label={accent}
                className={`w-7 h-7 rounded-lg border-2 transition-colors ${SWATCH_COLORS[accent]} ${
                  bot.accent === accent ? "border-stone-800" : "border-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        <textarea
          value={bot.persona ?? ""}
          onChange={(e) => patch({ persona: e.target.value })}
          rows={2}
          placeholder="말투·역할 지시 (선택). 예: 신규 선생님도 알아듣게 용어를 풀어서 설명해줘."
          className="w-full mt-3 bg-stone-50 border border-stone-200 rounded-[10px] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-assist/30 resize-none"
        />
        <p className="mt-1.5 text-[11px] text-stone-400 leading-relaxed">
          말투는 바꿀 수 있지만, &quot;자료에 없으면 지어내지 않는다&quot;는 규칙은 항상 유지됩니다.
        </p>
      </section>

      {/* 자료함 */}
      <section className="bg-white border border-stone-200 rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold tracking-wider text-stone-400">자료함 {documents.length}</h3>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 text-xs font-bold text-assist hover:opacity-80 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> 파일 추가
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </div>

        {documents.length === 0 && !uploading && (
          <p className="text-center text-xs text-stone-400 py-4">아직 올린 자료가 없습니다.</p>
        )}

        <ul className="divide-y divide-stone-100">
          {documents.map((doc) => {
            const pill = statusPill(doc);
            const percent =
              doc.chunkCount > 0 ? Math.round((doc.embeddedCount / doc.chunkCount) * 100) : 0;
            return (
              <li key={doc.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-assist/12 text-assist">
                  <FileUp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{doc.fileName}</p>
                  <p className="text-[11px] text-stone-400">
                    {formatSize(doc.byteSize)}
                    {doc.pageCount ? ` · ${doc.pageCount}쪽` : ""}
                    {doc.status === "ready" ? ` · 조각 ${doc.chunkCount}개` : ""}
                    {doc.status === "processing" ? ` · ${percent}%` : ""}
                  </p>
                  {doc.status === "processing" && (
                    <div className="h-1 mt-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
                    </div>
                  )}
                  {doc.status === "failed" && doc.error && (
                    <p className="text-[11px] text-rose-600 mt-0.5 leading-snug">{doc.error}</p>
                  )}
                  {doc.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => runIngest(doc.id, true)}
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-assist hover:opacity-80"
                    >
                      <RefreshCw className="w-3 h-3" /> 다시 분석
                    </button>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${pill.className}`}>
                  {pill.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeDocument(doc.id)}
                  className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-stone-300 hover:text-rose-600 hover:bg-rose-50"
                  aria-label="자료 삭제"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>

        {uploading && (
          <p className="flex items-center justify-center gap-2 text-xs text-assist py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 올리는 중…
          </p>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full mt-2 border border-dashed border-assist/30 bg-assist/5 rounded-[10px] py-3.5 text-xs font-bold text-assist hover:bg-assist/10 transition-colors disabled:opacity-50"
        >
          PDF · DOCX · 엑셀 · 텍스트 파일 올리기
          <span className="block mt-0.5 font-normal text-assist/70">
            한글(hwp)은 PDF로 저장한 뒤 올려주세요
          </span>
        </button>
      </section>

      {/* 추천 질문 */}
      <section className="bg-white border border-stone-200 rounded-[10px] p-4">
        <h3 className="text-[11px] font-bold tracking-wider text-stone-400 mb-3">추천 질문 (대화창 아래 칩)</h3>
        {bot.starters.map((starter, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input
              value={starter}
              onChange={(e) =>
                patch({ starters: bot.starters.map((s, j) => (j === i ? e.target.value : s)) })
              }
              className="flex-1 bg-stone-50 border border-stone-200 rounded-[10px] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-assist/30"
            />
            <button
              type="button"
              onClick={() => patch({ starters: bot.starters.filter((_, j) => j !== i) })}
              className="w-7 h-7 grid place-items-center rounded-lg text-stone-300 hover:text-rose-600"
              aria-label="추천 질문 삭제"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {bot.starters.length < 6 && (
          <button
            type="button"
            onClick={() => patch({ starters: [...bot.starters, ""] })}
            className="w-full border border-dashed border-stone-300 rounded-[10px] py-2 text-xs font-bold text-stone-400 hover:text-assist hover:border-assist/30 transition-colors"
          >
            ＋ 질문 추가
          </button>
        )}
      </section>

      {/* 개인정보 경고 */}
      <div className="flex gap-2.5 bg-orange-50 border border-orange-200 rounded-[10px] px-4 py-3">
        <TriangleAlert className="w-4 h-4 shrink-0 text-orange-600 mt-0.5" />
        <div className="text-[11.5px] text-orange-900 leading-relaxed">
          <b className="block mb-0.5">개인정보가 든 파일은 올리지 마세요</b>
          올린 파일의 내용은 답변을 만들기 위해 Google Gemini로 전송됩니다. 학생 이름·주민등록번호·성적처럼
          외부로 나가면 안 되는 정보가 든 문서는 제외해 주세요.
        </div>
      </div>

      <button
        type="button"
        onClick={removeBot}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-rose-600 transition-colors px-1 py-2"
      >
        <Trash2 className="w-3.5 h-3.5" /> 이 챗봇 삭제
      </button>
    </div>
  );
}
