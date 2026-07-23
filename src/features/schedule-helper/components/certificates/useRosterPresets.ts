"use client";

import { useCallback, useEffect, useState } from "react";

export interface RosterPreset {
  id: string;
  name: string;
  names: string[];
  updatedAt: string;
}

type MutationResult = { ok: true; preset: RosterPreset } | { ok: false; error: string };

export function useRosterPresets() {
  const [presets, setPresets] = useState<RosterPreset[] | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(true);

  const reloadPresets = useCallback(() => {
    setLoadingPresets(true);
    return fetch("/api/schedule-helper/certificates/roster-presets")
      .then((res) => res.json())
      .then((body) => setPresets(body.presets ?? []))
      .catch(() => setPresets([]))
      .finally(() => setLoadingPresets(false));
  }, []);

  // 최초 진입 시 저장된 명단을 불러옴 (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지,
  // reloadPresets는 setLoadingPresets(true)를 동기 호출하므로 여기서 그대로 재사용하지 않고 fetch 체인을 별도로 둠)
  useEffect(() => {
    fetch("/api/schedule-helper/certificates/roster-presets")
      .then((res) => res.json())
      .then((body) => setPresets(body.presets ?? []))
      .catch(() => setPresets([]))
      .finally(() => setLoadingPresets(false));
  }, []);

  const createPreset = useCallback(async (name: string, names: string[]): Promise<MutationResult> => {
    const res = await fetch("/api/schedule-helper/certificates/roster-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, names }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? "저장 중 오류가 발생했습니다." };
    setPresets((prev) => [body.preset, ...(prev ?? [])]);
    return { ok: true, preset: body.preset };
  }, []);

  const updatePreset = useCallback(
    async (id: string, patch: { name?: string; names?: string[] }): Promise<MutationResult> => {
      const res = await fetch(`/api/schedule-helper/certificates/roster-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error ?? "저장 중 오류가 발생했습니다." };
      setPresets((prev) => (prev ? prev.map((p) => (p.id === id ? body.preset : p)) : prev));
      return { ok: true, preset: body.preset };
    },
    []
  );

  const deletePreset = useCallback(async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const res = await fetch(`/api/schedule-helper/certificates/roster-presets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "삭제 중 오류가 발생했습니다." };
    }
    setPresets((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    return { ok: true };
  }, []);

  const fetchBaseRoster = useCallback(async (): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> => {
    const res = await fetch("/api/schedule-helper/certificates/roster-presets/base");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? "기본 명단을 불러오지 못했습니다." };
    return { ok: true, names: body.names ?? [] };
  }, []);

  return { presets, loadingPresets, reloadPresets, createPreset, updatePreset, deletePreset, fetchBaseRoster };
}
