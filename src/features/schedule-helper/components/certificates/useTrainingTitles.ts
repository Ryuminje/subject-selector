"use client";

import { useCallback, useEffect, useState } from "react";

export type TrainingTitleCategory = "certificate" | "sign";

export interface TrainingTitleItem {
  id: string;
  title: string;
  registeredByName: string;
  rosterSnapshot: string[] | null;
  category: TrainingTitleCategory;
}

type MutationResult = { ok: true; trainingTitle: TrainingTitleItem } | { ok: false; error: string };

export function useTrainingTitles() {
  const [titles, setTitles] = useState<TrainingTitleItem[] | null>(null);
  const [loadingTitles, setLoadingTitles] = useState(true);

  const reloadTitles = useCallback(() => {
    setLoadingTitles(true);
    return fetch("/api/schedule-helper/certificates/training-titles")
      .then((res) => res.json())
      .then((body) => setTitles(body.titles ?? []))
      .catch(() => setTitles([]))
      .finally(() => setLoadingTitles(false));
  }, []);

  // 최초 진입 시 등록된 연수를 불러옴 (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지)
  useEffect(() => {
    fetch("/api/schedule-helper/certificates/training-titles")
      .then((res) => res.json())
      .then((body) => setTitles(body.titles ?? []))
      .catch(() => setTitles([]))
      .finally(() => setLoadingTitles(false));
  }, []);

  const createTitle = useCallback(
    async (title: string, names: string[] | undefined, category: TrainingTitleCategory): Promise<MutationResult> => {
      const res = await fetch("/api/schedule-helper/certificates/training-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, names, category }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error ?? "등록 중 오류가 발생했습니다." };
      setTitles((prev) => [body.trainingTitle, ...(prev ?? [])]);
      return { ok: true, trainingTitle: body.trainingTitle };
    },
    []
  );

  const updateTitle = useCallback(
    async (
      id: string,
      patch: { title?: string; names?: string[]; category?: TrainingTitleCategory }
    ): Promise<MutationResult> => {
      const res = await fetch(`/api/schedule-helper/certificates/training-titles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error ?? "저장 중 오류가 발생했습니다." };
      setTitles((prev) => (prev ? prev.map((t) => (t.id === id ? body.trainingTitle : t)) : prev));
      return { ok: true, trainingTitle: body.trainingTitle };
    },
    []
  );

  const deleteTitle = useCallback(async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const res = await fetch(`/api/schedule-helper/certificates/training-titles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "삭제 중 오류가 발생했습니다." };
    }
    setTitles((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    return { ok: true };
  }, []);

  return { titles, loadingTitles, reloadTitles, createTitle, updateTitle, deleteTitle };
}
