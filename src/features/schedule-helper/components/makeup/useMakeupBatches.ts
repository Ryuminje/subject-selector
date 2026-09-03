"use client";

import { useCallback, useEffect, useState } from "react";
import type { MakeupEntry } from "@/features/schedule-helper/lib/makeup/types";

// 이름 붙여 저장하는 교체·보강 작업 세트(수업교체 도우미 트레이의 서버판) 상태.
// 계정별로 저장되므로 로그아웃했다 들어와도, 다른 날 이어서 해도 남습니다.
//
// useMeetingPresets.ts와 완전히 같은 모양입니다 — "이름 붙여 저장 → 목록에서 불러오기 →
// 지금 걸로 덮어쓰기 → 이름 바꾸기 → 삭제"가 똑같이 필요해서 그 패턴을 그대로 따릅니다.

export interface MakeupBatch {
  id: string;
  name: string;
  entries: MakeupEntry[];
  baseDate: string;
  updatedAt: string;
}

const API = "/api/schedule-helper/makeup-batches";

/** 서버가 돌려주는 에러 문구를 그대로 씁니다(사용자에게 보여줄 한국어가 라우트에 있습니다). */
async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export function useMakeupBatches() {
  const [batches, setBatches] = useState<MakeupBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(await readError(res, "작업 세트를 불러오지 못했습니다."));
      const body = (await res.json()) as { batches: MakeupBatch[] };
      setBatches(body.batches);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "작업 세트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 진입 시 목록을 불러옵니다. setState는 반드시 .then()/.catch()/.finally() 안에서만 —
  // 이펙트 본문에서 직접 부르면 react-hooks/set-state-in-effect에 걸립니다
  // (useMeetingPresets/useRosterPresets도 같은 이유로 이렇게 씁니다).
  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("작업 세트를 불러오지 못했습니다."))))
      .then((body) => setBatches((body.batches ?? []) as MakeupBatch[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "작업 세트를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  /** 저장 성공하면 null, 실패하면 사용자에게 보여줄 문구를 돌려줍니다. */
  const create = useCallback(
    async (name: string, entries: MakeupEntry[], baseDate: string): Promise<string | null> => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, entries, baseDate }),
      });
      if (!res.ok) return await readError(res, "저장하지 못했습니다.");
      await refresh();
      return null;
    },
    [refresh],
  );

  /** 이름 변경 또는 지금 트레이 내용으로 덮어쓰기. 넘긴 항목만 바뀝니다. */
  const update = useCallback(
    async (id: string, patch: { name?: string; entries?: MakeupEntry[]; baseDate?: string }): Promise<string | null> => {
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

  return { batches, loading, error, create, update, remove };
}
