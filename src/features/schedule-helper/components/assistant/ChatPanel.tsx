"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, RotateCcw, Send, Settings2 } from "lucide-react";
import { accentStyle } from "./accents";
import type { BotDetail, ChatMessage, Source } from "./types";

// 참고 이미지의 메신저 화면. 다른 점은 답변 아래 "근거" 칩이 붙는다는 것 —
// 학교 업무 문서는 어디서 나온 말인지 확인할 수 있어야 실제로 쓸 수 있습니다.

function sourceLabel(source: Source): string {
  return source.page ? `${source.fileName} ${source.page}쪽` : source.fileName;
}

export default function ChatPanel({
  bot,
  readyDocCount,
  canManage,
  onBack,
  onOpenSettings,
}: {
  bot: BotDetail;
  readyDocCount: number;
  canManage: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const style = accentStyle(bot.accent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 지난 대화 이어보기 — 메신저처럼 다시 들어오면 그대로 남아 있어야 합니다.
  useEffect(() => {
    fetch(`/api/schedule-helper/assistant/bots/${bot.id}/thread`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) return;
        setThreadId(body.threadId ?? null);
        setMessages(
          (body.messages ?? []).map((m: ChatMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources ?? [],
          }))
        );
      })
      .catch(() => {});
  }, [bot.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      setError(null);
      setInput("");
      setSending(true);

      const userId = `u-${Date.now()}`;
      const modelId = `m-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: trimmed, sources: [] },
        { id: modelId, role: "model", content: "", sources: [], streaming: true },
      ]);

      const patchModel = (patch: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === modelId ? { ...m, ...patch } : m)));

      try {
        const res = await fetch(`/api/schedule-helper/assistant/bots/${bot.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, threadId }),
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "답변을 받지 못했습니다.");
          setMessages((prev) => prev.filter((m) => m.id !== modelId));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const line = event.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = JSON.parse(line.slice(5).trim());

            if (payload.type === "meta") {
              setThreadId(payload.threadId);
            } else if (payload.type === "delta") {
              answer += payload.text;
              patchModel({ content: answer });
            } else if (payload.type === "done") {
              patchModel({ content: answer, sources: payload.sources ?? [], streaming: false });
            } else if (payload.type === "error") {
              patchModel({ content: answer, streaming: false });
              setError(payload.message);
            }
          }
        }
        patchModel({ streaming: false });
      } catch {
        setError("답변을 받는 중 연결이 끊겼습니다.");
        setMessages((prev) => prev.filter((m) => m.id !== modelId));
      } finally {
        setSending(false);
      }
    },
    [bot.id, sending, threadId]
  );

  const startNewThread = useCallback(async () => {
    await fetch(`/api/schedule-helper/assistant/bots/${bot.id}/thread`, { method: "DELETE" });
    setMessages([]);
    setThreadId(null);
    setError(null);
  }, [bot.id]);

  const noMaterial = readyDocCount === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] min-h-[520px] bg-white border border-stone-200 rounded-[14px] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-200 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
          aria-label="목록으로"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className={`w-10 h-10 shrink-0 grid place-items-center rounded-[10px] text-lg ${style.avatar}`}>
          {bot.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-stone-900 truncate">{bot.name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${noMaterial ? "bg-stone-300" : "bg-emerald-500"}`} />
            {noMaterial ? "분석된 자료 없음" : `자료 ${readyDocCount}개 기반 · 근거 표시`}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={startNewThread}
            className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            title="새 대화 시작"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            title="챗봇 설정"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 대화 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-stone-50 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="m-auto text-center px-6">
            <div className={`w-14 h-14 mx-auto grid place-items-center rounded-2xl text-2xl ${style.avatar}`}>
              {bot.emoji}
            </div>
            <p className="mt-3 font-bold text-stone-800">{bot.name}</p>
            <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">
              {noMaterial
                ? "먼저 자료를 올리고 분석이 끝나면 질문할 수 있습니다."
                : "올려둔 자료에서만 답을 찾습니다. 자료에 없으면 없다고 말합니다."}
            </p>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed ${style.bubble}`}>
                {message.content}
              </div>
            </div>
          ) : (
            <div key={message.id} className="flex gap-2.5">
              <div className={`w-8 h-8 shrink-0 grid place-items-center rounded-xl text-sm ${style.avatar}`}>
                {bot.emoji}
              </div>
              <div className="max-w-[85%] min-w-0">
                <p className="text-[11px] font-bold text-stone-500 mb-1.5">{bot.name}</p>
                <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-3.5 py-3 text-sm leading-relaxed text-stone-800 whitespace-pre-wrap break-words">
                  {message.content}
                  {message.streaming && (
                    <span className="inline-flex gap-1 ml-1 align-middle">
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${style.bar}`} />
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${style.bar}`} />
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${style.bar}`} />
                    </span>
                  )}

                  {message.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-dashed border-stone-200">
                      <p className="text-[10px] font-bold tracking-wider text-stone-400 mb-1.5">근거</p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.sources.map((source, i) => (
                          <span
                            key={`${source.documentId}-${source.page}-${i}`}
                            className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg bg-assist/10 border border-assist/25 text-assist"
                          >
                            <FileText className="w-3 h-3" />
                            {sourceLabel(source)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {error && <p className="px-4 py-2 text-xs text-rose-600 bg-rose-50 border-t border-rose-100">{error}</p>}

      {/* 추천 질문 */}
      {bot.starters.length > 0 && messages.length === 0 && !noMaterial && (
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto border-t border-stone-100 shrink-0">
          {bot.starters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => send(starter)}
              className="whitespace-nowrap text-xs font-bold px-3 py-1.5 rounded-full bg-assist/10 border border-assist/25 text-assist hover:bg-assist/15 transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {/* 입력 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 px-3 py-3 border-t border-stone-100 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={noMaterial || sending}
          placeholder={noMaterial ? "자료를 올리면 질문할 수 있습니다" : "질문을 입력하세요…"}
          className="flex-1 bg-stone-100 rounded-full px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-assist/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={noMaterial || sending || !input.trim()}
          className={`w-10 h-10 shrink-0 grid place-items-center rounded-full text-white transition-colors disabled:opacity-40 ${style.send}`}
          aria-label="보내기"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
