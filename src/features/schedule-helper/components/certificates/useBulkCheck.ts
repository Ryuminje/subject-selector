"use client";

import { useState } from "react";

interface BulkCheckResult {
  totalCount: number;
  submittedCount: number;
  submitted: string[];
  unsubmitted: string[];
}

export function useBulkCheck() {
  const [result, setResult] = useState<BulkCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (trainingTitle: string) => {
    if (!trainingTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schedule-helper/certificates/bulk-check?trainingTitle=${encodeURIComponent(trainingTitle.trim())}`
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "확인 중 오류가 발생했습니다.");
        setResult(null);
        return;
      }
      setResult(body);
    } catch {
      setError("확인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, check };
}
