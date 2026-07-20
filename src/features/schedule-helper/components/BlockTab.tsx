"use client";

import { useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { UserX, Search, CalendarOff, PlusCircle, X, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/features/schedule-helper/lib/utils";

export default function BlockTab() {
  const { data, localBlockSettings, addLocalBlock, removeLocalBlock } = useSchedule();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [tempDays, setTempDays] = useState<Record<string, Set<number>>>({});

  if (!data) return null;

  const filteredTeachers = data.teachers.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleTeacherSelect = (teacher: string) => {
    setSelectedTeacher(teacher);
    setTempDays({});
  };

  const toggleAllDays = () => {
    const allDaysOn = data.days.every(d => tempDays[d] && tempDays[d].size > 0);
    if (allDaysOn) {
      setTempDays({});
    } else {
      const newDays: Record<string, Set<number>> = {};
      data.days.forEach(d => {
        newDays[d] = new Set(data.periods);
      });
      setTempDays(newDays);
    }
  };

  const toggleDay = (day: string) => {
    const newDays = { ...tempDays };
    if (newDays[day]) {
      delete newDays[day];
    } else {
      newDays[day] = new Set(data.periods);
    }
    setTempDays(newDays);
  };

  const togglePeriod = (day: string, period: number) => {
    const newDays = { ...tempDays };
    if (!newDays[day]) newDays[day] = new Set();

    if (newDays[day].has(period)) {
      newDays[day].delete(period);
      if (newDays[day].size === 0) delete newDays[day];
    } else {
      newDays[day].add(period);
    }
    setTempDays(newDays);
  };

  const handleAddBlock = () => {
    if (!selectedTeacher) return;
    const toAdd: Record<string, number[]> = {};
    Object.entries(tempDays).forEach(([day, periodSet]) => {
      if (periodSet.size > 0) {
        toAdd[day] = Array.from(periodSet).sort((a, b) => a - b);
      }
    });

    if (Object.keys(toAdd).length > 0) {
      addLocalBlock(selectedTeacher, toAdd);
      setTempDays({});
    }
  };

  const hasAnySelection = Object.values(tempDays).some(set => set.size > 0);
  const localBlockEntries = Object.entries(localBlockSettings);
  const defaultBlockEntries = Object.entries(data.defaultBlockSettings || {});
  const totalBlockedTeachers = new Set([...localBlockEntries.map(e => e[0]), ...defaultBlockEntries.map(e => e[0])]).size;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">

      {/* 1. 교사 선택 */}
      <div className="flex-none lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-[600px] lg:h-auto">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <UserX className="w-5 h-5" /> 교사 선택
        </h2>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="교사 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {filteredTeachers.map((teacher) => {
            const isSelected = selectedTeacher === teacher;
            return (
              <div
                key={teacher}
                onClick={() => handleTeacherSelect(teacher)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all font-medium text-sm",
                  isSelected
                    ? "bg-teal-50 border-teal-500 text-teal-800 font-bold shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-slate-50"
                )}
              >
                {teacher} 선생님
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 임시 설정 영역 */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <CalendarOff className="w-5 h-5" /> 임시 교체 불가 설정
        </h2>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 flex gap-3 text-amber-800 text-sm leading-relaxed">
          <Info className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <strong>안내:</strong> &apos;설정&apos; 시트의 내용이 기본 적용되어 있습니다.<br/>
            <strong>오늘 갑자기 결근·출장</strong>이 생긴 교사가 있다면 여기서 추가하세요. 이 설정은 현재 브라우저에 저장됩니다.
          </div>
        </div>

        {!selectedTeacher ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <UserX className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-semibold text-slate-500">왼쪽에서 교사를 선택해주세요</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-rose-600 mb-6 flex items-center gap-2">
              <UserX className="w-6 h-6" /> {selectedTeacher} 선생님
            </h3>

            <div className="mb-8">
              <div className="text-sm font-bold text-slate-700 mb-3">📅 교체 불가 요일 선택</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleAllDays}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold border transition-colors",
                    data.days.every(d => tempDays[d] && tempDays[d].size > 0)
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-white border-slate-300 text-slate-600 hover:border-rose-300 hover:text-rose-600"
                  )}
                >
                  전체
                </button>
                {data.days.map(d => {
                  const isOn = tempDays[d] && tempDays[d].size > 0;
                  return (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold border transition-colors",
                        isOn
                          ? "bg-rose-50 border-rose-300 text-rose-700"
                          : "bg-white border-slate-300 text-slate-600 hover:border-rose-300 hover:text-rose-600"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {data.days.filter(d => tempDays[d]).map(d => (
              <div key={d} className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-sm font-bold text-slate-700 mb-3 flex items-baseline gap-2">
                  🕐 {d}요일 교시 설정 <span className="text-[11px] font-normal text-slate-500">(체크 해제 = 교체 가능)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {data.periods.map(p => {
                    const isChecked = tempDays[d]?.has(p);
                    return (
                      <label
                        key={p}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2 border rounded-xl cursor-pointer text-sm transition-all select-none",
                          isChecked
                            ? "bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50/50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => togglePeriod(d, p)}
                          className="sr-only"
                        />
                        {p}교시
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={handleAddBlock}
              disabled={!hasAnySelection}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                hasAnySelection
                  ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <PlusCircle className="w-5 h-5" /> 목록에 추가 적용하기
            </button>
          </div>
        )}
      </div>

      {/* 3. 적용 목록 */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> 전체 교체 불가 목록
          <span className="text-sm font-medium text-slate-500 ml-1">({totalBlockedTeachers}명)</span>
        </h2>

        {totalBlockedTeachers === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <CheckCircle2 className="w-16 h-16 mb-4 opacity-20 text-emerald-500" />
            <p className="font-semibold text-emerald-600">현재 적용된 교체 불가 교사가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 구글 시트 기본 설정 목록 */}
            {defaultBlockEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 mb-2 px-1">구글 시트 고정 설정 (삭제 불가)</h3>
                <div className="space-y-2">
                  {defaultBlockEntries.map(([teacher, dayMap]) => {
                    const tags = Object.entries(dayMap).map(([day, periods]) => {
                      const label = periods.length === data.periods.length ? `${day} 전일` : `${day}요일 ${periods.join('·')}교시`;
                      return (
                        <span key={day} className="inline-block bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold mr-2 mb-1">
                          {label}
                        </span>
                      );
                    });

                    return (
                      <div key={teacher} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl opacity-80">
                        <div className="flex-1">
                          <div className="font-bold text-slate-600 mb-1 flex items-center gap-2">
                            <UserX className="w-4 h-4" /> {teacher} 선생님
                          </div>
                          <div>{tags}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 임시 설정 목록 */}
            {localBlockEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-rose-500 mb-2 px-1 mt-4">브라우저 임시 설정</h3>
                <div className="space-y-2">
                  {localBlockEntries.map(([teacher, dayMap]) => {
                    const tags = Object.entries(dayMap).map(([day, periods]) => {
                      const label = periods.length === data.periods.length ? `${day} 전일` : `${day}요일 ${periods.join('·')}교시`;
                      return (
                        <span key={day} className="inline-block bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold mr-2 mb-1">
                          {label}
                        </span>
                      );
                    });

                    return (
                      <div key={teacher} className="flex items-start gap-3 p-3 bg-white border-2 border-rose-100 rounded-xl shadow-sm">
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <UserX className="w-4 h-4 text-rose-500" /> {teacher} 선생님
                          </div>
                          <div>{tags}</div>
                        </div>
                        <button
                          onClick={() => removeLocalBlock(teacher)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="삭제"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
