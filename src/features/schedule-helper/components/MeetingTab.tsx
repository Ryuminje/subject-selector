"use client";

import { useState, useMemo } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { Filter, Users, CalendarCheck, Search, Undo, Calendar, Check } from "lucide-react";
import { cn } from "@/features/schedule-helper/lib/utils";

export default function MeetingTab() {
  const { data } = useSchedule();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());

  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(["월", "화", "수", "목", "금"]));
  const [selectedPeriods, setSelectedPeriods] = useState<Set<number>>(new Set(data?.periods || []));

  // 계산 로직 (자동으로 계산됨) — 조건부 렌더링(아래 `if (!data)`)보다 먼저 호출되어야 하는 훅이므로 이 위치에 둡니다.
  const availableTimes = useMemo(() => {
    if (!data || selectedTeachers.size < 2) return [];

    const times: { day: string; period: number }[] = [];
    data.days.forEach((day) => {
      if (!selectedDays.has(day)) return;
      data.periods.forEach((period) => {
        if (!selectedPeriods.has(period)) return;

        // 글로벌 회의 블록 확인
        if (data.globalMeetingBlocks[day]?.includes(period)) return;

        // 선택된 모든 교사가 해당 시간에 공강인지 확인
        let allFree = true;
        for (const teacher of Array.from(selectedTeachers)) {
          const row = data.tableData.find((r) => r.teacher === teacher);
          if (row && row[day + period] && row[day + period].trim() !== "") {
            allFree = false;
            break;
          }
        }
        if (allFree) times.push({ day, period });
      });
    });
    return times;
  }, [data, selectedTeachers, selectedDays, selectedPeriods]);

  if (!data) return null;

  const filteredTeachers = data.teachers.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleTeacher = (teacher: string) => {
    const newSet = new Set(selectedTeachers);
    if (newSet.has(teacher)) newSet.delete(teacher);
    else newSet.add(teacher);
    setSelectedTeachers(newSet);
  };

  const toggleDay = (day: string) => {
    const newSet = new Set(selectedDays);
    if (newSet.has(day)) newSet.delete(day);
    else newSet.add(day);
    setSelectedDays(newSet);
  };

  const togglePeriod = (period: number) => {
    const newSet = new Set(selectedPeriods);
    if (newSet.has(period)) newSet.delete(period);
    else newSet.add(period);
    setSelectedPeriods(newSet);
  };

  const resetSelection = () => {
    setSelectedTeachers(new Set());
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">

      {/* 1. 검색 및 필터 패널 */}
      <div className="flex-none lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" /> 검색 및 필터
        </h2>

        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="교사 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> 요일 필터
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.days.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-slate-200/50 px-2 py-1 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={selectedDays.has(day)}
                  onChange={() => toggleDay(day)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 accent-teal-600 cursor-pointer"
                />
                {day}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100 flex-1">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" /> 교시 필터
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.periods.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-slate-200/50 px-2 py-1 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={selectedPeriods.has(p)}
                  onChange={() => togglePeriod(p)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 accent-teal-600 cursor-pointer"
                />
                {p}교시
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={resetSelection}
          className="w-full py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Undo className="w-4 h-4" /> 전체 해제
        </button>
      </div>

      {/* 2. 교사 선택 패널 */}
      <div className="flex-none lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-[600px] lg:h-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
            <Users className="w-5 h-5" /> 교사 선택
          </h2>
          {selectedTeachers.size > 0 && (
            <span className="bg-teal-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {selectedTeachers.size}명 선택됨
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {filteredTeachers.map((teacher) => {
            const isSelected = selectedTeachers.has(teacher);
            return (
              <div
                key={teacher}
                onClick={() => toggleTeacher(teacher)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 select-none",
                  isSelected
                    ? "bg-teal-50 border-teal-500 text-teal-800 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-slate-50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center border",
                  isSelected ? "bg-teal-500 border-teal-500 text-white" : "border-slate-300 bg-white"
                )}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={cn("font-medium text-sm", isSelected && "font-bold")}>{teacher} 선생님</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 결과 패널 */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[400px]">
        <h2 className="text-lg font-bold text-teal-700 mb-6 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5" /> 협의회 가능 시간
        </h2>

        {selectedTeachers.size < 2 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-semibold text-slate-500">교사를 2명 이상 선택해주세요.</p>
          </div>
        ) : availableTimes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-rose-400">
            <p className="font-bold text-lg">조건에 맞는 공강 시간이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
            {availableTimes.map((time, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center animate-in zoom-in-95 duration-200"
              >
                <div className="text-xl font-bold mb-1">{time.day}요일</div>
                <div className="text-emerald-100 font-medium">{time.period}교시</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
