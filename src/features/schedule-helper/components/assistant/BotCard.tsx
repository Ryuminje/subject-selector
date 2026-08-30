"use client";

import { ChevronRight } from "lucide-react";
import { accentStyle } from "./accents";
import type { BotSummary } from "./types";

// 목록의 챗봇 한 줄. 자료 수와 "분석 중/실패" 상태를 여기서 바로 보여줘서,
// 굳이 설정 화면에 들어가지 않아도 지금 쓸 수 있는 챗봇인지 알 수 있게 합니다.

export default function BotCard({
  bot,
  selected,
  onSelect,
}: {
  bot: BotSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = accentStyle(bot.accent);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3.5 bg-white border rounded-[10px] text-left transition-colors ${
        selected ? style.selected : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <div className={`w-11 h-11 shrink-0 grid place-items-center rounded-[10px] text-lg ${style.avatar}`}>
        {bot.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-900 truncate">{bot.name}</p>
        {bot.tagline && <p className="mt-0.5 text-xs text-stone-500 truncate">{bot.tagline}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-500">
            자료 {bot.docCount}개
          </span>
          {bot.workingCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
              분석 중 {bot.workingCount}개
            </span>
          )}
          {bot.failedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700">
              실패 {bot.failedCount}개
            </span>
          )}
          {!bot.mine && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
              {bot.ownerName} 만듦
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 shrink-0 text-stone-300" />
    </button>
  );
}
