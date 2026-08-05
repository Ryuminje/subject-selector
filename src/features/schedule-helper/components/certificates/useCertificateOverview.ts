"use client";

import { useCallback, useEffect, useState } from "react";

export type TrainingCategory = "certificate" | "sign";
export type MyStatus = "done" | "todo" | "out";

export interface OverviewItem {
  id: string;
  title: string;
  registeredByName: string;
  category: TrainingCategory;
  createdAt: string;
  hasOwnRoster: boolean;
  total: number;
  doneCount: number;
  missingCount: number;
  myStatus: MyStatus;
  canManage: boolean;
  /** 관리자 또는 담당자에게만 내려옵니다. 그 외에는 null. */
  done: string[] | null;
  missing: string[] | null;
  session: { id: string; locked: boolean; createdAt: string } | null;
}

export function useCertificateOverview() {
  const [items, setItems] = useState<OverviewItem[] | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    return fetch("/api/schedule-helper/certificates/overview")
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setItems(body.items ?? []);
        setMyName(body.myName ?? "");
        setError(null);
      })
      .catch(() => setError("현황을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  // 최초 진입 로드 — setState는 항상 .then()/.finally() 안에서만 호출합니다
  // (이펙트 본문에서 직접 setState 금지, useRosterPresets와 동일한 규칙).
  useEffect(() => {
    fetch("/api/schedule-helper/certificates/overview")
      .then((res) => res.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setItems(body.items ?? []);
        setMyName(body.myName ?? "");
      })
      .catch(() => setError("현황을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const byCategory = useCallback(
    (category: TrainingCategory) => (items ?? []).filter((i) => i.category === category),
    [items]
  );

  return { items, myName, loading, error, reload, byCategory };
}
