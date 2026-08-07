"use client";

import { useCallback, useEffect, useState } from "react";
import type { BotSummary } from "./types";

// 챗봇 목록. 이 프로젝트의 eslint 규칙(react-hooks/set-state-in-effect) 때문에
// 상태 변경은 전부 .then()/.finally() 안에서만 일어납니다.

export function useAssistantBots() {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    return fetch("/api/schedule-helper/assistant/bots")
      .then((res) => res.json())
      .then((body) => {
        if (body?.error) {
          setError(body.error);
          return;
        }
        setError(null);
        setBots(body.items ?? []);
      })
      .catch(() => setError("목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createBot = useCallback(
    async (input: { name: string; tagline: string; emoji: string; accent: string }) => {
      const res = await fetch("/api/schedule-helper/assistant/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false as const, error: body?.error ?? "챗봇을 만들지 못했습니다." };
      await reload();
      return { ok: true as const, id: body.id as string };
    },
    [reload]
  );

  const deleteBot = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/schedule-helper/assistant/bots/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false as const, error: body?.error ?? "삭제하지 못했습니다." };
      await reload();
      return { ok: true as const };
    },
    [reload]
  );

  return { bots, loading, error, reload, createBot, deleteBot };
}
