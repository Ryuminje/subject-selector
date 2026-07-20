"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChangeGradeKey, ElectiveChange } from "../types";

interface ElectiveChangeTableProps {
  title: string;
  titleColorClass: string;
  changeActiveGrade: ChangeGradeKey;
  data: Record<string, ElectiveChange[]>;
  setData: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
}

export function ElectiveChangeTable({
  title,
  titleColorClass,
  changeActiveGrade,
  data,
  setData,
}: ElectiveChangeTableProps) {
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
                    <td colSpan={7} className="px-6 py-12 text-center text-stone-600">
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
                          onChange={e => updateItem("afterSubject", e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-white/70 border border-stone-300 rounded px-2 py-1.5 text-stone-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 text-center text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
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
