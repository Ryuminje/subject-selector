"use client";

import { useCallback, useState } from "react";
import type { MakeupEntry } from "@/features/schedule-helper/lib/makeup/types";

/**
 * 보강원 작성 트레이 상태.
 *
 * SwapTab이 이미 검색 로직만으로 400줄이 넘어서, 문서 상태까지 그 안에 두면
 * 손대기 어려워집니다. 담기/빼기만 여기로 빼고 SwapTab은 호출만 합니다.
 */
export function useMakeupTray() {
  const [entries, setEntries] = useState<MakeupEntry[]>([]);

  /** 같은 수업을 같은 사람에게 두 번 담는 것을 막습니다(문서에 중복 줄이 생김). */
  const add = useCallback((entry: Omit<MakeupEntry, "id">) => {
    setEntries((prev) => {
      const duplicate = prev.some(
        (e) =>
          e.absentTeacher === entry.absentTeacher &&
          e.absent.day === entry.absent.day &&
          e.absent.period === entry.absent.period
      );
      if (duplicate) return prev;
      return [...prev, { ...entry, id: crypto.randomUUID() }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  /** 자동 계산된 날짜를 사용자가 고칠 때 */
  const setDateOverride = useCallback(
    (id: string, field: "absentDateOverride" | "exchangeDateOverride", value: string) => {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value || undefined } : e)));
    },
    []
  );

  /**
   * 그 시간에 이미 담긴 항목. 한 결강 시간에는 한 사람만 들어가므로,
   * 이걸로 후보 버튼을 "담김"이나 "이미 다른 분으로 담김" 상태로 바꿔 보여줍니다.
   */
  const entryFor = useCallback(
    (absentTeacher: string, day: string, period: number) =>
      entries.find(
        (e) => e.absentTeacher === absentTeacher && e.absent.day === day && e.absent.period === period
      ),
    [entries]
  );

  return { entries, add, remove, clear, setDateOverride, entryFor };
}
