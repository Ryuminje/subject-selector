"use client";

import { useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import { UserX, Search, CalendarOff, PlusCircle, X, CheckCircle2, Info, Ban, AlertTriangle } from "lucide-react";
import { cn, extractSubjects } from "@/features/schedule-helper/lib/utils";

export default function BlockTab() {
  const { data, sharedBlockSettings, addSharedBlock, removeSharedBlock, refetch } = useSchedule();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [tempDays, setTempDays] = useState<Record<string, Set<number>>>({});
  const [newSubject, setNewSubject] = useState("");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");

  if (!data) return null;

  const filteredTeachers = data.teachers.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  const allSubjects = extractSubjects(data.tableData);
  const availableSubjects = allSubjects.filter((s) => !data.blockedSubjects.includes(s));
  const matchingSubjects = availableSubjects.filter((s) => s.toLowerCase().includes(newSubject.trim().toLowerCase()));
  const isExactRealSubject = allSubjects.includes(newSubject.trim());

  const matchingBlockableTeachers = data.teachers.filter(
    (t) => !data.blockedTeachers.includes(t) && t.toLowerCase().includes(teacherQuery.trim().toLowerCase())
  );

  const handleAddSubject = async (subjectArg?: string) => {
    const subject = (subjectArg ?? newSubject).trim();
    if (!subject) return;
    setSubjectError(null);
    const res = await fetch("/api/schedule-helper/blocked-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubjectError(body.error ?? "추가에 실패했습니다.");
      return;
    }
    setNewSubject("");
    await refetch();
  };

  const handleRemoveSubject = async (subject: string) => {
    await fetch("/api/schedule-helper/blocked-subjects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    await refetch();
  };

  const handleAddBlockedTeacher = async (teacher: string) => {
    await fetch("/api/schedule-helper/blocked-teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher }),
    });
    setTeacherQuery("");
    await refetch();
  };

  const handleRemoveBlockedTeacher = async (teacher: string) => {
    await fetch("/api/schedule-helper/blocked-teachers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher }),
    });
    await refetch();
  };

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

  const handleAddBlock = async () => {
    if (!selectedTeacher) return;
    const toAdd: Record<string, number[]> = {};
    Object.entries(tempDays).forEach(([day, periodSet]) => {
      if (periodSet.size > 0) {
        toAdd[day] = Array.from(periodSet).sort((a, b) => a - b);
      }
    });

    if (Object.keys(toAdd).length > 0) {
      await addSharedBlock(selectedTeacher, toAdd);
      setTempDays({});
    }
  };

  const hasAnySelection = Object.values(tempDays).some(set => set.size > 0);
  const sharedBlockEntries = Object.entries(sharedBlockSettings);
  const defaultBlockEntries = Object.entries(data.defaultBlockSettings || {});
  const totalBlockedTeachers = new Set([...sharedBlockEntries.map(e => e[0]), ...defaultBlockEntries.map(e => e[0])]).size;

  return (
    <div className="space-y-6">

      {/* 0. 과목별 교체 금지 + 0-1. 교사별 교체 금지 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <Ban className="w-5 h-5" /> 과목별 교체 금지
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          여기 등록된 과목은 어떤 선생님이 가르치든 시간을 바꿀 수 없습니다(대강은 가능).
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {data.blockedSubjects.length === 0 ? (
            <span className="text-sm text-slate-400">등록된 과목이 없습니다.</span>
          ) : (
            data.blockedSubjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-sm font-bold"
              >
                {subject}
                {isAdmin && (
                  <button onClick={() => handleRemoveSubject(subject)} className="hover:bg-rose-100 rounded-full transition-colors" title="삭제">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {isAdmin && (
          <div>
            {allSubjects.length === 0 ? (
              <p className="text-sm text-slate-400">먼저 시간표를 업로드해야 과목을 검색할 수 있습니다.</p>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                    placeholder="시간표에 있는 과목명을 검색하세요..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                  {matchingSubjects.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400">일치하는 과목이 없습니다.</div>
                  ) : (
                    matchingSubjects.map((subject) => (
                      <button
                        key={subject}
                        onClick={() => handleAddSubject(subject)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                      >
                        {subject}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {newSubject.trim() && !isExactRealSubject && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-amber-600 flex items-center gap-1 flex-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 시간표에 없는 과목명입니다. 그래도 직접 추가할 수 있습니다.
                </p>
                <button
                  onClick={() => handleAddSubject()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> 직접 추가
                </button>
              </div>
            )}
            {subjectError && <p className="text-xs text-rose-600 mt-2">{subjectError}</p>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <UserX className="w-5 h-5" /> 교사별 교체 금지
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          여기 등록된 교사는 어떤 수업이든 교체와 대강 모두에서 완전히 제외됩니다.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {data.blockedTeachers.length === 0 ? (
            <span className="text-sm text-slate-400">등록된 교사가 없습니다.</span>
          ) : (
            data.blockedTeachers.map((teacher) => (
              <span
                key={teacher}
                className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-sm font-bold"
              >
                {teacher} 선생님
                {isAdmin && (
                  <button onClick={() => handleRemoveBlockedTeacher(teacher)} className="hover:bg-rose-100 rounded-full transition-colors" title="삭제">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {isAdmin && (
          <div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={teacherQuery}
                onChange={(e) => setTeacherQuery(e.target.value)}
                placeholder="교사 이름을 검색하세요..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
              {matchingBlockableTeachers.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">일치하는 교사가 없습니다.</div>
              ) : (
                matchingBlockableTeachers.map((teacher) => (
                  <button
                    key={teacher}
                    onClick={() => handleAddBlockedTeacher(teacher)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors"
                  >
                    {teacher} 선생님
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      </div>

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
            <strong>안내:</strong> 관리자가 교사 목록에서 설정한 고정 교체불가 설정이 기본 적용되어 있습니다.<br/>
            <strong>오늘 갑자기 결근·출장</strong>이 생긴 교사가 있다면 여기서 추가하세요. 이 설정은 우리 학교 선생님 모두에게 공유됩니다.
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
            {/* 관리자 고정 설정 목록 */}
            {defaultBlockEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 mb-2 px-1">관리자 고정 설정 (여기서 삭제 불가 — 교사 목록에서 수정)</h3>
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
            {sharedBlockEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-rose-500 mb-2 px-1 mt-4">학교 공유 임시 설정</h3>
                <div className="space-y-2">
                  {sharedBlockEntries.map(([teacher, dayMap]) => {
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
                          onClick={() => removeSharedBlock(teacher)}
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
    </div>
  );
}
