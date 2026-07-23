"use client";

import { useCallback, useEffect, useState } from "react";

export interface PastSession {
  id: string;
  trainingTitles: string[];
  isGroup: boolean;
  locked: boolean;
  createdAt: string;
  totalCount: number;
  signedCount: number;
  rosterPresetName: string | null;
}

export function useSignSession() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<PastSession[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const createSession = useCallback(
    async (titles: string[], roster?: string[], rosterPresetName?: string | null): Promise<string | null> => {
      setCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/schedule-helper/certificates/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingTitles: titles, roster, rosterPresetName }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "세션 생성 중 오류가 발생했습니다.");
          return null;
        }
        return body.sessionId as string;
      } catch {
        setError("세션 생성 중 오류가 발생했습니다.");
        return null;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  const loadPastSessions = useCallback(() => {
    setLoadingSessions(true);
    fetch("/api/schedule-helper/certificates/sessions")
      .then((res) => res.json())
      .then((body) => setPastSessions(body.sessions ?? []))
      .catch(() => setPastSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  // 최초 진입 시 이전 세션 목록을 불러옴 (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지)
  useEffect(() => {
    fetch("/api/schedule-helper/certificates/sessions")
      .then((res) => res.json())
      .then((body) => setPastSessions(body.sessions ?? []))
      .catch(() => setPastSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  return { creating, error, createSession, pastSessions, loadingSessions, loadPastSessions };
}
