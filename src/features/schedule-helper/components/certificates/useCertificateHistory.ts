"use client";

import { useCallback, useEffect, useState } from "react";

export interface CertificateHistoryRow {
  id: string;
  teacherName: string;
  trainingTitle: string;
  number: string;
  institution: string;
  certDate: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export function useCertificateHistory(isAdmin: boolean) {
  const [rows, setRows] = useState<CertificateHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(!isAdmin);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: { teacherName?: string; titleQuery?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params.teacherName) query.set("teacherName", params.teacherName);
      if (params.titleQuery) query.set("titleQuery", params.titleQuery);
      const res = await fetch(`/api/schedule-helper/certificates/history?${query.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "조회 중 오류가 발생했습니다.");
        return;
      }
      setRows(body.certificates);
    } catch {
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 일반 교사는 진입 즉시 본인 내역을 불러옴 (setState는 항상 .then() 안에서만 — 이펙트 본문에서 직접 호출 금지)
  useEffect(() => {
    if (isAdmin) return;
    fetch("/api/schedule-helper/certificates/history")
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) {
          setError(body.error ?? "조회 중 오류가 발생했습니다.");
          return;
        }
        setRows(body.certificates);
      })
      .catch(() => setError("조회 중 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/schedule-helper/certificates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "삭제 중 오류가 발생했습니다." };
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    return { ok: true };
  }, []);

  return { rows, loading, error, search, remove };
}
