"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ScheduleData } from "./sheetData";

interface BlockSettings {
  [teacher: string]: {
    [day: string]: number[];
  };
}

interface ScheduleContextType {
  data: ScheduleData | null;
  loading: boolean;
  error: string | null;
  localBlockSettings: BlockSettings;
  addLocalBlock: (teacher: string, blocks: Record<string, number[]>) => void;
  removeLocalBlock: (teacher: string) => void;
  isBlocked: (teacher: string, day: string, period: number) => boolean;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localBlockSettings, setLocalBlockSettings] = useState<BlockSettings>({});

  // 1. 초기 데이터 페칭
  useEffect(() => {
    fetch('/api/schedule')
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "데이터를 가져오는데 실패했습니다.");
        }
        return res.json();
      })
      .then((res: ScheduleData) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 2. 로컬 스토리지에서 임시 블록 설정 불러오기
  useEffect(() => {
    try {
      const stored = localStorage.getItem("schedule_local_blocks");
      if (stored) {
        // localStorage는 클라이언트에서만 접근 가능해 SSR 초기값으로 넣을 수 없으므로, 마운트 이펙트에서 1회 반영합니다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalBlockSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load local blocks", e);
    }
  }, []);

  // 3. 로컬 스토리지 저장 헬퍼
  const saveBlocks = (newBlocks: BlockSettings) => {
    setLocalBlockSettings(newBlocks);
    localStorage.setItem("schedule_local_blocks", JSON.stringify(newBlocks));
  };

  const addLocalBlock = (teacher: string, blocks: Record<string, number[]>) => {
    const newBlocks = { ...localBlockSettings };
    if (!newBlocks[teacher]) newBlocks[teacher] = {};

    Object.entries(blocks).forEach(([day, periods]) => {
      if (!newBlocks[teacher][day]) {
        newBlocks[teacher][day] = periods;
      } else {
        newBlocks[teacher][day] = Array.from(new Set([...newBlocks[teacher][day], ...periods])).sort((a, b) => a - b);
      }
    });
    saveBlocks(newBlocks);
  };

  const removeLocalBlock = (teacher: string) => {
    const newBlocks = { ...localBlockSettings };
    delete newBlocks[teacher];
    saveBlocks(newBlocks);
  };

  const isBlocked = (teacher: string, day: string, period: number) => {
    if (!data) return false;

    // 시트에서 가져온 기본 차단
    if (data.defaultBlockSettings[teacher]?.[day]?.includes(period)) return true;

    // 클라이언트 로컬 차단
    if (localBlockSettings[teacher]?.[day]?.includes(period)) return true;

    return false;
  };

  return (
    <ScheduleContext.Provider
      value={{
        data,
        loading,
        error,
        localBlockSettings,
        addLocalBlock,
        removeLocalBlock,
        isBlocked
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
