"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import BotCard from "./BotCard";
import ChatPanel from "./ChatPanel";
import BotSettingsPanel from "./BotSettingsPanel";
import NewBotForm from "./NewBotForm";
import { useAssistantBots } from "./useAssistantBots";
import { useBotDetail } from "./useBotDetail";

// 목록 ↔ 대화 ↔ 설정을 오가는 껍데기.
// 데스크톱은 왼쪽 목록 + 오른쪽 대화 2단(이수증 수거 화면과 같은 언어),
// 모바일은 참고 이미지처럼 한 번에 한 화면씩 보여줍니다.

type View = "board" | "new" | "settings";

export default function AssistantApp() {
  const { bots, loading, error, reload, createBot } = useAssistantBots();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");

  const selected = bots.find((b) => b.id === selectedId) ?? null;
  const detail = useBotDetail(selected ? selected.id : null);

  const handleCreate = async (input: { name: string; tagline: string; emoji: string; accent: string }) => {
    const result = await createBot(input);
    if (result.ok) {
      setSelectedId(result.id);
      // 만들자마자 자료를 올려야 쓸 수 있으므로 바로 설정 화면으로 보냅니다.
      setView("settings");
    }
    return result;
  };

  if (view === "new") {
    return (
      <div className="max-w-lg mx-auto">
        <NewBotForm onCancel={() => setView("board")} onCreate={handleCreate} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-5 items-start">
      {/* 왼쪽: 챗봇 목록 (모바일에서는 챗봇을 고르면 숨김) */}
      <div className={`${selectedId ? "hidden lg:block" : "block"}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-wider text-stone-400">내 챗봇 {bots.length}개</span>
          <button
            type="button"
            onClick={() => setView("new")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 챗봇
          </button>
        </div>

        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

        {loading ? (
          <div className="grid place-items-center py-16 text-amber-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : bots.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-stone-500 leading-relaxed">
              아직 만든 챗봇이 없습니다.
              <br />
              업무 자료를 올려두면 그 자료만 근거로 답하는
              <br />
              나만의 챗봇이 만들어집니다.
            </p>
            <button
              type="button"
              onClick={() => setView("new")}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors"
            >
              첫 챗봇 만들기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                selected={bot.id === selectedId}
                onSelect={() => {
                  setSelectedId(bot.id);
                  setView("board");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 대화 또는 설정 */}
      <div className={`${selectedId ? "block" : "hidden lg:block"}`}>
        {!selected ? (
          <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-sm text-stone-400">
            왼쪽에서 챗봇을 고르세요.
          </div>
        ) : detail.loading || !detail.bot ? (
          <div className="grid place-items-center py-24 text-amber-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : view === "settings" ? (
          <BotSettingsPanel
            botId={selected.id}
            onBack={() => setView("board")}
            onChanged={() => {
              reload();
              detail.reload();
            }}
            onDeleted={() => {
              setSelectedId(null);
              setView("board");
              reload();
            }}
          />
        ) : (
          <ChatPanel
            // 챗봇을 바꾸면 대화 상태가 남지 않도록 통째로 새로 그립니다.
            key={selected.id}
            bot={detail.bot}
            readyDocCount={detail.readyDocCount}
            canManage={detail.canManage}
            onBack={() => setSelectedId(null)}
            onOpenSettings={() => setView("settings")}
          />
        )}
      </div>
    </div>
  );
}
