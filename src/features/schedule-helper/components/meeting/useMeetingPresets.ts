"use client";

import { useCallback, useEffect, useState } from "react";

// 협의회 교사 프리셋 상태. 서버(계정)에 저장되므로 로그아웃했다 들어와도, 다른 기기에서도 남습니다.
//
// MeetingTab이 이미 계산 로직으로 200줄이 넘어서 통신·목록 상태는 여기로 빼두었습니다.

export interface MeetingPreset {
  id: string;
  name: string;
  teachers: string[];
}

const API = "/api/schedule-helper/meeting-presets";

/** 서버가 돌려주는 에러 문구를 그대로 씁니다(사용자에게 보여줄 한국어가 라우트에 있습니다). */
async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export function useMeetingPresets() {
  const [presets, setPresets] = useState<MeetingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(await readError(res, "프리셋을 불러오지 못했습니다."));
      const body = (await res.json()) as { presets: MeetingPreset[] };
      setPresets(body.presets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "프리셋을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 진입 시 목록을 불러옵니다.
  // setState는 반드시 .then()/.catch()/.finally() 안에서만 — 이펙트 본문에서 직접 부르면
  // react-hooks/set-state-in-effect에 걸립니다(useRosterPresets도 같은 이유로 이렇게 씁니다).
  // 그래서 refresh()를 그대로 부르지 않고 fetch 체인을 따로 둡니다.
  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("프리셋을 불러오지 못했습니다."))))
      .then((body) => setPresets((body.presets ?? []) as MeetingPreset[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "프리셋을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  /** 저장 성공하면 null, 실패하면 사용자에게 보여줄 문구를 돌려줍니다. */
  const create = useCallback(
    async (name: string, teachers: string[]): Promise<string | null> => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, teachers }),
      });
      if (!res.ok) return await readError(res, "저장하지 못했습니다.");
      await refresh();
      return null;
    },
    [refresh],
  );

  /** 이름 변경 또는 지금 선택으로 덮어쓰기. 넘긴 항목만 바뀝니다. */
  const update = useCallback(
    async (id: string, patch: { name?: string; teachers?: string[] }): Promise<string | null> => {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return await readError(res, "수정하지 못했습니다.");
      await refresh();
      return null;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) return await readError(res, "삭제하지 못했습니다.");
      await refresh();
      return null;
    },
    [refresh],
  );

  return { presets, loading, error, create, update, remove };
}
