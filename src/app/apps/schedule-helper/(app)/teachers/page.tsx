"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/features/schedule-helper/lib/utils";
import { ArrowLeft, Users, Search, Save, ShieldAlert, Loader2 } from "lucide-react";

interface TeacherRow {
  id: string;
  name: string;
  department: string | null;
  fixedBlockDays: Record<string, number[]>;
}

export default function TeacherRosterPage() {
  const { data } = useSchedule();
  const { data: session } = useSession();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [blockDays, setBlockDays] = useState<Record<string, Set<number>>>({});
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/schedule-helper/teachers")
      .then((res) => res.json())
      .then((body) => {
        setTeachers(body.teachers ?? []);
        setLoading(false);
      });
  }, []);

  const selectTeacher = (teacher: TeacherRow) => {
    setSelectedId(teacher.id);
    setDepartment(teacher.department ?? "");
    const asSets: Record<string, Set<number>> = {};
    Object.entries(teacher.fixedBlockDays).forEach(([day, periods]) => {
      asSets[day] = new Set(periods);
    });
    setBlockDays(asSets);
  };

  const toggleDay = (day: string) => {
    const next = { ...blockDays };
    if (next[day]) {
      delete next[day];
    } else {
      next[day] = new Set(data?.periods ?? []);
    }
    setBlockDays(next);
  };

  const togglePeriod = (day: string, period: number) => {
    const next = { ...blockDays };
    const set = new Set(next[day] ?? []);
    if (set.has(period)) {
      set.delete(period);
    } else {
      set.add(period);
    }
    if (set.size === 0) delete next[day];
    else next[day] = set;
    setBlockDays(next);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    const fixedBlockDays: Record<string, number[]> = {};
    Object.entries(blockDays).forEach(([day, set]) => {
      if (set.size > 0) fixedBlockDays[day] = Array.from(set).sort((a, b) => a - b);
    });

    const res = await fetch(`/api/schedule-helper/teachers/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department, fixedBlockDays }),
    });
    setSaving(false);
    if (!res.ok) return;
    const updated = await res.json();
    setTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const filteredTeachers = teachers.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedTeacher = teachers.find((t) => t.id === selectedId);
  const days = data?.days ?? ["월", "화", "수", "목", "금"];
  const periods = data?.periods ?? [];

  if (!isAdmin) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-semibold text-slate-600">관리자만 접근할 수 있는 페이지입니다.</p>
        <Link href="/apps/schedule-helper" className="inline-block mt-6 text-teal-700 font-semibold hover:underline">
          돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-[1920px] mx-auto px-2 md:px-6 py-6 w-full">
      <Link
        href="/apps/schedule-helper"
        className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        수업교체 도우미로 돌아가기
      </Link>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 md:p-8 rounded-3xl shadow-lg text-white mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <Users className="w-7 h-7" /> 교사 목록 관리
        </h1>
        <p className="text-emerald-50 font-medium text-sm md:text-base">
          교과군과 고정 교체 불가 요일/교시를 교사별로 직접 설정합니다.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-teal-700">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          {/* 교사 목록 */}
          <div className="flex-none lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-[600px] lg:h-auto">
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
              {filteredTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => selectTeacher(teacher)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all text-sm",
                    selectedId === teacher.id
                      ? "bg-teal-50 border-teal-500 text-teal-800 font-bold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-slate-50"
                  )}
                >
                  <div className="font-medium">{teacher.name} 선생님</div>
                  {teacher.department && <div className="text-xs text-slate-400 mt-0.5">{teacher.department}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* 편집 영역 */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            {!selectedTeacher ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-semibold text-slate-500">왼쪽에서 교사를 선택해주세요</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                <h3 className="text-xl font-bold text-teal-700 mb-6">{selectedTeacher.name} 선생님</h3>

                <div className="mb-8">
                  <label className="block text-sm font-bold text-slate-700 mb-2">교과군</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="예: 국어, 수학, 영어..."
                    className="w-full max-w-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    같은 교과군 교사끼리는 &quot;교체 시간표 찾기&quot;에서 동과 대강 후보로 우선 추천됩니다.
                  </p>
                </div>

                <div className="mb-8">
                  <div className="text-sm font-bold text-slate-700 mb-3">📅 고정 교체 불가 요일 선택</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {days.map((d) => {
                      const isOn = !!blockDays[d];
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

                  {days.filter((d) => blockDays[d]).map((d) => (
                    <div key={d} className="mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-sm font-bold text-slate-700 mb-3">🕐 {d}요일 교시</div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {periods.map((p) => {
                          const isChecked = blockDays[d]?.has(p);
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
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
