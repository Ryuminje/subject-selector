"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { ScheduleRow } from "./sheetData";

interface BlockSettings {
  [teacher: string]: {
    [day: string]: number[];
  };
}

// /api/schedule 응답 형태 — 시간표 원본(teachers/days/periods/tableData)에
// 학교별 Teacher 레코드에서 조립한 defaultBlockSettings/tempBlockSettings/teacherDepts,
// School의 globalMeetingBlocks를 합친 것입니다. sheetData.ts의 파싱 전용 ScheduleData와는
// 다른, API 응답 전용 타입입니다.
export interface ScheduleData {
  teachers: string[];
  days: string[];
  periods: number[];
  tableData: ScheduleRow[];
  defaultBlockSettings: Record<string, Record<string, number[]>>;
  tempBlockSettings: Record<string, Record<string, number[]>>;
  globalMeetingBlocks: Record<string, number[]>;
  teacherDepts: Record<string, string>;
  scheduleUploadedAt: string | null;
  joinCode: string | null;
}

interface ScheduleContextType {
  data: ScheduleData | null;
  loading: boolean;
  error: string | null;
  sharedBlockSettings: BlockSettings;
  addSharedBlock: (teacher: string, blocks: Record<string, number[]>) => Promise<void>;
  removeSharedBlock: (teacher: string) => Promise<void>;
  isBlocked: (teacher: string, day: string, period: number) => boolean;
  refetch: () => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

async function loadSchedule(): Promise<ScheduleData> {
  const res = await fetch("/api/schedule");
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "데이터를 가져오는데 실패했습니다.");
  }
  return res.json();
}

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedBlockSettings, setSharedBlockSettings] = useState<BlockSettings>({});

  const refetch = async () => {
    try {
      const res = await loadSchedule();
      setData(res);
      setSharedBlockSettings(res.tempBlockSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 가져오는데 실패했습니다.");
    }
  };

  // 초기 데이터 페칭 (시간표 + 학교 전체가 공유하는 임시 교체불가 설정 포함)
  useEffect(() => {
    loadSchedule()
      .then((res) => {
        setData(res);
        setSharedBlockSettings(res.tempBlockSettings);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 오늘 결근/출장 등 임시 설정 추가 — 학교 서버에 저장되어 같은 학교 선생님 모두에게 공유됩니다.
  const addSharedBlock = async (teacher: string, blocks: Record<string, number[]>) => {
    const res = await fetch("/api/schedule/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherName: teacher, blocks }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setSharedBlockSettings((prev) => ({ ...prev, [teacher]: body.tempBlockDays }));
  };

  const removeSharedBlock = async (teacher: string) => {
    const res = await fetch("/api/schedule/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherName: teacher }),
    });
    if (!res.ok) return;
    setSharedBlockSettings((prev) => {
      const next = { ...prev };
      delete next[teacher];
      return next;
    });
  };

  const isBlocked = (teacher: string, day: string, period: number) => {
    if (!data) return false;

    // 관리자가 교사 목록에서 지정한 고정 차단
    if (data.defaultBlockSettings[teacher]?.[day]?.includes(period)) return true;

    // 학교 전체가 공유하는 임시 차단 (오늘 결근/출장 등)
    if (sharedBlockSettings[teacher]?.[day]?.includes(period)) return true;

    return false;
  };

  return (
    <ScheduleContext.Provider
      value={{
        data,
        loading,
        error,
        sharedBlockSettings,
        addSharedBlock,
        removeSharedBlock,
        isBlocked,
        refetch
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used within a ScheduleProvider");
  return context;
};
