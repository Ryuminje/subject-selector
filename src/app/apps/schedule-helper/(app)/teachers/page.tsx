"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/features/schedule-helper/lib/utils";
import { ArrowLeft, Users, Search, Save, ShieldAlert, Loader2, Plus, X } from "lucide-react";

interface TeacherRow {
  id: string;
  name: string;
  department: string | null;
  fixedBlockDays: Record<string, number[]>;
}

export default function TeacherRosterPage() {
  const { data, refetch } = useSchedule();
  const { data: session } = useSession();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [departmentGroups, setDepartmentGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockDays, setBlockDays] = useState<Record<string, Set<number>>>({});
  const [saving, setSaving] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string>>(new Set());
  const [groupSaving, setGroupSaving] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/schedule-helper/teachers")
      .then((res) => res.json())
      .then((body) => {
        setTeachers(body.teachers ?? []);
        setDepartmentGroups(body.departmentGroups ?? []);
        setLoading(false);
      });
  }, []);

  const selectTeacher = (teacher: TeacherRow) => {
    setSelectedId(teacher.id);
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
      body: JSON.stringify({ fixedBlockDays }),
    });
    setSaving(false);
    if (!res.ok) return;
    const updated = await res.json();
    setTeachers((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    // 방금 저장한 fixedBlockDays가 "수업교체 도우미" 화면의 캐시된 시간표 데이터(교체 불가 판정)에도 반영되도록 갱신
    await refetch();
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setAddingGroup(true);
    const res = await fetch("/api/schedule-helper/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setAddingGroup(false);
    if (!res.ok) return;
    const body = await res.json();
    setDepartmentGroups(body.groups ?? []);
    setNewGroupName("");
  };

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`"${name}" 교과군을 삭제할까요? 소속 교사는 모두 미배정 상태가 됩니다.`)) return;
    const res = await fetch("/api/schedule-helper/departments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setDepartmentGroups(body.groups ?? []);
    setTeachers((prev) => prev.map((t) => (t.department === name ? { ...t, department: null } : t)));
    if (selectedGroup === name) setSelectedGroup(null);
    // 교과군 삭제로 바뀐 교사별 department가 "수업교체 도우미"의 동과 대강 매칭에도 반영되도록 갱신
    await refetch();
  };

  const selectGroup = (name: string) => {
    setSelectedGroup(name);
    setGroupMemberIds(new Set(teachers.filter((t) => t.department === name).map((t) => t.id)));
  };

  const toggleGroupMember = (id: string) => {
    const next = new Set(groupMemberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGroupMemberIds(next);
  };

  const handleSaveGroup = async () => {
    if (!selectedGroup) return;
    setGroupSaving(true);
    const res = await fetch("/api/schedule-helper/teachers/assign-department", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: selectedGroup, teacherIds: Array.from(groupMemberIds) }),
    });
    setGroupSaving(false);
    if (!res.ok) return;
    setTeachers((prev) =>
      prev.map((t) => {
        if (groupMemberIds.has(t.id)) return { ...t, department: selectedGroup };
        if (t.department === selectedGroup) return { ...t, department: null };
        return t;
      })
    );
    // 방금 바뀐 교과군 배정이 "수업교체 도우미"의 동과 대강 매칭(teacherDepts)에도 반영되도록 갱신
    await refetch();
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
          교과군과 고정 교체 불가 요일/교시를 관리합니다.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-teal-700">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* 교과군 관리 */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-teal-700 mb-4">교과군 관리</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {departmentGroups.map((g) => {
                const count = teachers.filter((t) => t.department === g).length;
                const isSelected = selectedGroup === g;
                return (
                  <div
                    key={g}
                    className={cn(
                      "flex items-center gap-1 pl-4 pr-1.5 py-2 rounded-xl border text-sm font-bold transition-colors",
                      isSelected
                        ? "bg-teal-50 border-teal-500 text-teal-800"
                        : "bg-white border-slate-300 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                    )}
                  >
                    <button onClick={() => selectGroup(g)} className="flex items-center gap-1.5 cursor-pointer">
                      {g} <span className="text-xs font-normal opacity-70">({count})</span>
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(g)}
                      className="p-1 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="교과군 삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                placeholder="새 교과군 이름 (예: 정보, 체육)"
                className="flex-1 max-w-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />
              <button
                onClick={handleAddGroup}
                disabled={addingGroup || !newGroupName.trim()}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
              >
                {addingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </button>
            </div>

            {selectedGroup && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-200">
                <div className="text-sm font-bold text-slate-700 mb-3">
                  &quot;{selectedGroup}&quot;에 배정할 교사 선택
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
                  {teachers.map((t) => {
                    const checked = groupMemberIds.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer text-sm transition-all select-none",
                          checked
                            ? "bg-teal-50 border-teal-300 text-teal-800 font-semibold"
                            : "bg-white border-slate-200 text-slate-600 hover:border-teal-200"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupMember(t.id)}
                          className="sr-only"
                        />
                        {t.name}
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={handleSaveGroup}
                  disabled={groupSaving}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                  {groupSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </div>
            )}
          </div>

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
                    <p className="text-sm text-slate-600">
                      {selectedTeacher.department ?? <span className="text-slate-400">미배정</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      위 &quot;교과군 관리&quot;에서 그룹을 선택해 배정을 바꿀 수 있습니다.
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
        </>
      )}
    </main>
  );
}
