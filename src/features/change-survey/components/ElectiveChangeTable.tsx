"use client";

import React from "react";
import { Plus, Trash2, Lock } from "lucide-react";
import type { ChangeGradeKey, ElectiveChange, GradeStringArrays, TimetableData } from "../types";
import { findSlotsWithSubject } from "../lib/subjectMatch";

interface ElectiveChangeTableProps {
  title: string;
  titleColorClass: string;
  changeActiveGrade: ChangeGradeKey;
  data: Record<string, ElectiveChange[]>;
  setData: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
  // When provided, enables the "타임 고정" column so the user can pin an
  // exact target time slot for a change request instead of letting the
  // algorithm search for one.
  timetableData?: TimetableData;
  timeSlots?: GradeStringArrays;
  classCols?: GradeStringArrays;
}

export function ElectiveChangeTable({
  title,
  titleColorClass,
  changeActiveGrade,
  data,
  setData,
  timetableData,
  timeSlots,
  classCols,
}: ElectiveChangeTableProps) {
  const enablePinning = !!(timetableData && timeSlots && classCols);
  const gradeTimetable = timetableData?.[changeActiveGrade] ?? {};
  const gradeTimeSlots = timeSlots?.[changeActiveGrade] ?? [];
  const gradeCols = classCols?.[changeActiveGrade] ?? [];
  const colCount = enablePinning ? 8 : 7;

  return (
    <div className="bg-stone-100 border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
      <div className="p-4 bg-stone-200 border-b border-stone-300">
        <h3 className={`font-semibold ${titleColorClass}`}>{title}</h3>
      </div>
      <div className="overflow-auto relative">
        <table className="w-full text-sm text-left text-stone-600 border-collapse">
          <thead className="text-xs text-stone-600 bg-stone-100 border-b border-stone-300 uppercase">
            <tr>
              <th className="px-3 py-3 font-semibold text-center w-12 border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">순번</th>
              <th className="px-4 py-3 font-semibold text-center w-24 border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">학번</th>
              <th className="px-4 py-3 font-semibold text-center w-24 border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">이름</th>
              <th className="px-4 py-3 font-semibold text-center border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">변경전</th>
              <th className="px-2 py-3 font-semibold text-center w-8 border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">→</th>
              <th className="px-4 py-3 font-semibold text-center border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">변경후</th>
              {enablePinning && (
                <th className="px-2 py-3 font-semibold text-center w-28 border-r border-stone-300 sticky top-0 z-10 bg-stone-100 shadow-sm">타임 고정</th>
              )}
              <th className="px-2 py-3 font-semibold text-center w-12 sticky top-0 z-10 bg-stone-100 shadow-sm">
                <button onClick={() => {
                  setData(prev => ({
                    ...prev,
                    [changeActiveGrade]: [{
                      id: Date.now().toString() + Math.random().toString(36).substring(7),
                      studentId: "",
                      studentName: "",
                      beforeSubject: "",
                      afterSubject: "",
                      isNew: true
                    }, ...prev[changeActiveGrade]]
                  }));
                }} className="p-1 text-stone-600 hover:text-emerald-700 transition-colors">
                  <Plus className="w-5 h-5 mx-auto" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const gradeData = data[changeActiveGrade];
              const sortedData = [...gradeData].sort((a, b) => {
                  const isCompleteA = (a.studentId||'').trim() && (a.studentName||'').trim() && (a.beforeSubject||'').trim() && (a.afterSubject||'').trim();
                  const isCompleteB = (b.studentId||'').trim() && (b.studentName||'').trim() && (b.beforeSubject||'').trim() && (b.afterSubject||'').trim();
                  const isPendingNewA = a.isNew;
                  const isPendingNewB = b.isNew;
                  if (isPendingNewA && !isPendingNewB) return -1;
                  if (!isPendingNewA && isPendingNewB) return 1;
                  if (isPendingNewA && isPendingNewB) return 0;
                  const valA = String(a.studentId || "").trim();
                  const valB = String(b.studentId || "").trim();
                  return valA.localeCompare(valB);
              });
              if (sortedData.length === 0) {
                return (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-12 text-center text-stone-600">
                      등록된 선택과목 변경 신청 내역이 없습니다.<br />
                      우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                    </td>
                  </tr>
                );
              }

              const groupedData: { studentId: string; items: ElectiveChange[] }[] = [];
              sortedData.forEach(item => {
                const lastGroup = groupedData[groupedData.length - 1];
                if (lastGroup && lastGroup.studentId === item.studentId && lastGroup.studentId !== "") {
                  lastGroup.items.push(item);
                } else {
                  groupedData.push({ studentId: item.studentId, items: [item] });
                }
              });

              let globalIndex = 0;
              return groupedData.map((group) => {
                return group.items.map((item, itemIdx) => {
                  const currentIndex = globalIndex++;
                  const isFirstInGroup = itemIdx === 0;
                  const rowSpan = group.items.length;

                  const updateItem = (field: string, value: string) => {
                    setData(prev => {
                      const newData = [...prev[changeActiveGrade]];
                      const index = newData.findIndex(x => x.id === item.id);
                      if (index > -1) newData[index] = { ...newData[index], [field]: value };
                      return { ...prev, [changeActiveGrade]: newData };
                    });
                  };

                  const handleBlur = () => {
                    setData(prev => {
                      const newData = [...prev[changeActiveGrade]];
                      let modified = false;
                      group.items.forEach((gItem) => {
                        if (gItem.isNew) {
                          const isComplete = (gItem.studentId||'').trim() && (gItem.studentName||'').trim() && (gItem.beforeSubject||'').trim() && (gItem.afterSubject||'').trim();
                          if (isComplete) {
                            const idx = newData.findIndex(x => x.id === gItem.id);
                            if (idx > -1) {
                              newData[idx] = { ...newData[idx] };
                              delete newData[idx].isNew;
                              modified = true;
                            }
                          }
                        }
                      });
                      return modified ? { ...prev, [changeActiveGrade]: newData } : prev;
                    });
                  };

                  return (
                    <tr key={item.id} className="border-b border-stone-200 hover:bg-stone-50 transition-colors">
                      <td className="px-3 py-2 text-center border-r border-stone-300 text-stone-600">{currentIndex + 1}</td>
                      {isFirstInGroup && (
                        <>
                          <td rowSpan={rowSpan} className="px-2 py-2 border-r border-stone-300 align-top">
                            <input
                              type="text"
                              value={item.studentId}
                              onChange={e => {
                                const val = e.target.value;
                                setData(prev => {
                                  const newData = [...prev[changeActiveGrade]];
                                  group.items.forEach((gItem) => {
                                    const idx = newData.findIndex(x => x.id === gItem.id);
                                    if (idx > -1) newData[idx] = { ...newData[idx], studentId: val };
                                  });
                                  return { ...prev, [changeActiveGrade]: newData };
                                });
                              }}
                              onBlur={handleBlur}
                              className="w-full bg-white/70 border border-stone-300 rounded px-2 py-1.5 text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 text-center text-sm"
                              placeholder="학번"
                            />
                          </td>
                          <td rowSpan={rowSpan} className="px-2 py-2 border-r border-stone-300 align-top">
                            <input
                              type="text"
                              value={item.studentName}
                              onChange={e => {
                                const val = e.target.value;
                                setData(prev => {
                                  const newData = [...prev[changeActiveGrade]];
                                  group.items.forEach((gItem) => {
                                    const idx = newData.findIndex(x => x.id === gItem.id);
                                    if (idx > -1) newData[idx] = { ...newData[idx], studentName: val };
                                  });
                                  return { ...prev, [changeActiveGrade]: newData };
                                });
                              }}
                              onBlur={handleBlur}
                              className="w-full bg-white/70 border border-stone-300 rounded px-2 py-1.5 text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 text-center text-sm"
                              placeholder="이름"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 border-r border-stone-300">
                        <input
                          type="text"
                          value={item.beforeSubject}
                          onChange={e => updateItem("beforeSubject", e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-white/70 border border-stone-300 rounded px-2 py-1.5 text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 text-center text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center text-stone-500 border-r border-stone-300">→</td>
                      <td className="px-2 py-2 border-r border-stone-300">
                        <input
                          type="text"
                          value={item.afterSubject}
                          onChange={e => {
                            const val = e.target.value;
                            setData(prev => {
                              const newData = [...prev[changeActiveGrade]];
                              const index = newData.findIndex(x => x.id === item.id);
                              // 변경후 과목을 바꾸면 이전에 고른 고정 타임은 더 이상 유효하지 않으므로 초기화
                              if (index > -1) newData[index] = { ...newData[index], afterSubject: val, pinnedSlot: "" };
                              return { ...prev, [changeActiveGrade]: newData };
                            });
                          }}
                          onBlur={handleBlur}
                          className="w-full bg-white/70 border border-stone-300 rounded px-2 py-1.5 text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 text-center text-sm"
                        />
                      </td>
                      {enablePinning && (() => {
                        const availableSlots = findSlotsWithSubject(item.afterSubject || "", gradeTimetable, gradeTimeSlots, gradeCols);
                        // 고정한 타임이 (예: 데이터 변경 등으로) 더 이상 유효한 후보가 아니게 되어도
                        // <select>가 조용히 "자동"으로 보이지 않도록, 항상 옵션에 포함시켜 준다.
                        const isPinInvalid = !!item.pinnedSlot && !availableSlots.includes(item.pinnedSlot);
                        return (
                          <td className="px-2 py-2 border-r border-stone-300">
                            <select
                              value={item.pinnedSlot || ""}
                              onChange={e => updateItem("pinnedSlot", e.target.value)}
                              disabled={availableSlots.length === 0 && !isPinInvalid}
                              className={`w-full border rounded px-1.5 py-1.5 text-center text-sm focus:outline-none focus:ring-1 ${isPinInvalid
                                  ? "bg-rose-100 border-rose-400 text-rose-900 focus:ring-rose-500"
                                  : item.pinnedSlot
                                    ? "bg-amber-100 border-amber-400 text-amber-900 focus:ring-amber-500"
                                    : "bg-white/70 border-stone-300 text-stone-800 focus:border-amber-400 focus:ring-amber-500"
                                } disabled:bg-stone-100 disabled:text-stone-400`}
                              title={isPinInvalid
                                ? `고정한 ${item.pinnedSlot} 타임에는 '${item.afterSubject}' 과목이 개설되어 있지 않습니다`
                                : item.pinnedSlot
                                  ? `이 요청은 ${item.pinnedSlot} 타임으로 고정됩니다 (1순위)`
                                  : "변경후 과목이 개설된 타임 중 하나로 고정할 수 있습니다"}
                            >
                              <option value="">자동</option>
                              {isPinInvalid && (
                                <option value={item.pinnedSlot}>{item.pinnedSlot} 타임 (개설 안 됨)</option>
                              )}
                              {availableSlots.map(slot => (
                                <option key={slot} value={slot}>{slot} 타임</option>
                              ))}
                            </select>
                          </td>
                        );
                      })()}
                      <td className="px-2 py-2 text-center">
                        {enablePinning && item.pinnedSlot && (
                          <Lock className="w-3 h-3 text-amber-600 inline-block mr-1" aria-label="고정됨" />
                        )}
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => {
                            setData(prev => {
                              const newData = [...prev[changeActiveGrade]];
                              const currentIdx = newData.findIndex(x => x.id === item.id);
                              const newItem = {
                                id: Date.now().toString() + Math.random().toString(36).substring(7),
                                studentId: item.studentId,
                                studentName: item.studentName,
                                beforeSubject: "",
                                afterSubject: ""
                              };
                              newData.splice(currentIdx + 1, 0, newItem);
                              return { ...prev, [changeActiveGrade]: newData };
                            });
                          }} className="p-1 text-stone-600 hover:text-emerald-700 transition-colors" title="같은 학생 과목 추가">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => {
                            setData(prev => ({
                              ...prev,
                              [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                            }));
                          }} className="p-1 text-stone-600 hover:text-red-400 transition-colors" title="삭제">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
