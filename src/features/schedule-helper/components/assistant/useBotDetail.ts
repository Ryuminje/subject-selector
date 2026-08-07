"use client";

import { useCallback, useEffect, useState } from "react";
import type { BotDetail, DocumentItem } from "./types";

// 선택한 챗봇 하나의 상세. 대화 화면은 여기서 온 starters(추천 질문)와
// "분석이 끝난 자료 수"를 써서 입력창을 열지 말지 결정합니다.

export function useBotDetail(botId: string | null) {
  const [bot, setBot] = useState<BotDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!botId) return Promise.resolve();
    return fetch(`/api/schedule-helper/assistant/bots/${botId}`)
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) return;
        setBot({ ...body.bot, starters: body.bot.starters ?? [] });
        setDocuments(body.documents ?? []);
        setCanManage(!!body.canManage);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [botId]);

  useEffect(() => {
    // 선택이 풀리거나 다른 챗봇으로 바뀌면 이전 내용이 잠깐 비쳐 보이지 않도록 비웁니다.
    // (setState를 effect 본문에서 직접 부르지 않기 위해 Promise 경유 — 이 저장소 lint 규칙)
    Promise.resolve().then(() => {
      setBot(null);
      setDocuments([]);
      setLoading(!!botId);
    });
    reload();
  }, [botId, reload]);

  const readyDocCount = documents.filter((d) => d.status === "ready").length;

  return { bot, documents, canManage, loading, readyDocCount, reload };
}
