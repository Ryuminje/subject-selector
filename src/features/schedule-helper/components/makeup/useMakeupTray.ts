"use client";

import { useCallback, useEffect, useState } from "react";
import type { MakeupEntry } from "@/features/schedule-helper/lib/makeup/types";
import { absentDateOf, dateForWeekday, formatDate } from "@/features/schedule-helper/lib/makeup/buildRows";

/**
 * 보강원 작성 트레이 상태.
 *
 * SwapTab이 이미 검색 로직만으로 400줄이 넘어서, 문서 상태까지 그 안에 두면
 * 손대기 어려워집니다. 담기/빼기만 여기로 빼고 SwapTab은 호출만 합니다.
 */
export function useMakeupTray() {
  const [entries, setEntries] = useState<MakeupEntry[]>([]);

  // 결강 주간 기준일 — "화요일 7교시" 같은 요일+교시를 실제 달력 날짜로 바꿀 때 기준이
  // 되는 주(월요일 시작)입니다. 트레이 전체가 기본으로 공유하고, 항목이 실은 다른 주라면
  // 그 항목만 setDateOverride로 따로 날짜를 덮어씁니다 — 두 항목이 같은 "화7"이어도
  // 이 기준일이 다른 주를 가리키면 서로 다른 날이라 충돌로 보지 않습니다(SwapTab의
  // isTeacherBusyViaTray, entryFor 아래가 여기 기댑니다).
  //
  // 예전엔 MakeupTray.tsx가 이 값을 지역 상태로만 들고 있어 인쇄 미리보기에만 쓰였는데,
  // SwapTab의 충돌 판정도 같은 값을 알아야 해서 여기로 끌어올렸습니다. 렌더 중 new Date()를
  // 부르면 서버/클라이언트 렌더 값이 어긋날 수 있어(MakeupTray.tsx가 원래 쓰던 것과 같은
  // 이유) 마운트 후에 채웁니다.
  const [baseDate, setBaseDate] = useState("");
  useEffect(() => {
    Promise.resolve().then(() => setBaseDate((prev) => prev || formatDate(new Date())));
  }, []);

  /**
   * 같은 결강을 두 번 담는 것을 막습니다(문서에 중복 줄이 생김).
   * "같은 결강" = 같은 교사·같은 교시·같은 실제 결강 날짜. 예전엔 요일 문자열만 비교해서,
   * 요일이 같으면 실제로는 몇 주 뒤라도 중복으로 막혔습니다.
   */
  const add = useCallback(
    (entry: Omit<MakeupEntry, "id">) => {
      setEntries((prev) => {
        const newDate = absentDateOf(entry, baseDate);
        const duplicate = prev.some(
          (e) => e.absentTeacher === entry.absentTeacher && e.absent.period === entry.absent.period && absentDateOf(e, baseDate) === newDate
        );
        if (duplicate) return prev;
        return [...prev, { ...entry, id: crypto.randomUUID() }];
      });
    },
    [baseDate]
  );

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
   * teacher가 그 요일·교시에 실제로(=실제 결강 날짜 기준으로) 이미 트레이에 담겨 있는지.
   * 한 결강 시간에는 한 사람만 들어가므로, 이걸로 후보 버튼을 "담김"이나 "이미 다른 분으로
   * 담김" 상태로 바꿔 보여줍니다. day를 그대로 비교하지 않고 baseDate 기준 실제 날짜로
   * 바꿔서 비교합니다 — 같은 "화7"이어도 항목이 다른 주로 덮어써져 있으면 다른 날입니다.
   */
  const entryFor = useCallback(
    (absentTeacher: string, day: string, period: number) => {
      const targetDate = dateForWeekday(baseDate, day);
      return entries.find(
        (e) => e.absentTeacher === absentTeacher && e.absent.period === period && absentDateOf(e, baseDate) === targetDate
      );
    },
    [entries, baseDate]
  );

  return { entries, add, remove, clear, setDateOverride, entryFor, baseDate, setBaseDate };
}
