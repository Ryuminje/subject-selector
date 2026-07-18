"use client";

import React from "react";
import { FileText, Plus, Trash2, Download } from "lucide-react";
import type { ChangeGradeKey } from "../types";

type AdjustmentLog = Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary' }[]>;

interface ApplicationStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  electiveChanges: Record<string, any[]>;
  setElectiveChanges: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  electiveChangesArbitrary: Record<string, any[]>;
  setElectiveChangesArbitrary: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  enableOptimization: boolean;
  setEnableOptimization: (v: boolean) => void;
  handleExportChanges: () => void;
  adjustmentLog: AdjustmentLog;
}

export function ApplicationStep({
  changeActiveGrade,
  setChangeActiveGrade,
  electiveChanges,
  setElectiveChanges,
  electiveChangesArbitrary,
  setElectiveChangesArbitrary,
  enableOptimization,
  setEnableOptimization,
  handleExportChanges,
  adjustmentLog,
}: ApplicationStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-400" />
          선택과목 변경 신청 내역
        </h2>
        <div className="flex bg-slate-800/50 p-1 rounded-xl">
          <button
            onClick={() => setChangeActiveGrade("grade2")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                ? "bg-indigo-500 text-white shadow-md"
                : "text-white hover:text-white"
              }`}
          >
            2학년
          </button>
          <button
            onClick={() => setChangeActiveGrade("grade3")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                ? "bg-indigo-500 text-white shadow-md"
                : "text-white hover:text-white"
              }`}
          >
            3학년
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="flex flex-col gap-6 w-full min-w-0">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
            <h3 className="font-semibold text-slate-200">변경 신청 입력(신청자)</h3>
          </div>
          <div className="overflow-auto relative">
            <table className="w-full text-sm text-left text-slate-300 border-collapse">
              <thead className="text-xs text-slate-300 bg-slate-800 border-b border-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-3 font-semibold text-center w-12 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">순번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">학번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">이름</th>
                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경전</th>
                  <th className="px-2 py-3 font-semibold text-center w-8 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">→</th>
                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경후</th>
                  <th className="px-2 py-3 font-semibold text-center w-12 sticky top-0 z-10 bg-slate-800 shadow-sm">
                    <button onClick={() => {
                      setElectiveChanges(prev => ({
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
                    }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors">
                      <Plus className="w-5 h-5 mx-auto" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const data = electiveChanges[changeActiveGrade];
                  const sortedData = [...data].sort((a, b) => {
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
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-300">
                          등록된 선택과목 변경 신청 내역이 없습니다.<br />
                          우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                        </td>
                      </tr>
                    );
                  }

                  const groupedData: any[] = [];
                  sortedData.forEach(item => {
                    const lastGroup = groupedData[groupedData.length - 1];
                    if (lastGroup && lastGroup.studentId === item.studentId && lastGroup.studentId !== "") {
                      lastGroup.items.push(item);
                    } else {
                      groupedData.push({ studentId: item.studentId, items: [item] });
                    }
                  });

                  let globalIndex = 0;
                  return groupedData.map((group: any, groupIdx: number) => {
                    return group.items.map((item: any, itemIdx: number) => {
                      const currentIndex = globalIndex++;
                      const isFirstInGroup = itemIdx === 0;
                      const rowSpan = group.items.length;

                      const updateItem = (field: string, value: string) => {
                        setElectiveChanges(prev => {
                          const newData = [...prev[changeActiveGrade]];
                          const index = newData.findIndex(x => x.id === item.id);
                          if (index > -1) newData[index] = { ...newData[index], [field]: value };
                          return { ...prev, [changeActiveGrade]: newData };
                        });
                      };

                      const handleBlur = () => {
                        setElectiveChanges(prev => {
                          const newData = [...prev[changeActiveGrade]];
                          let modified = false;
                          group.items.forEach((gItem: any) => {
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
                        <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                          <td className="px-3 py-2 text-center border-r border-slate-700/50 text-slate-300">{currentIndex + 1}</td>
                          {isFirstInGroup && (
                            <>
                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                <input
                                  type="text"
                                  value={item.studentId}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setElectiveChanges(prev => {
                                      const newData = [...prev[changeActiveGrade]];
                                      group.items.forEach((gItem: any) => {
                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                        if (idx > -1) newData[idx] = { ...newData[idx], studentId: val };
                                      });
                                      return { ...prev, [changeActiveGrade]: newData };
                                    });
                                  }}
                                  onBlur={handleBlur}
                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                  placeholder="학번"
                                />
                              </td>
                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                <input
                                  type="text"
                                  value={item.studentName}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setElectiveChanges(prev => {
                                      const newData = [...prev[changeActiveGrade]];
                                      group.items.forEach((gItem: any) => {
                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                        if (idx > -1) newData[idx] = { ...newData[idx], studentName: val };
                                      });
                                      return { ...prev, [changeActiveGrade]: newData };
                                    });
                                  }}
                                  onBlur={handleBlur}
                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                  placeholder="이름"
                                />
                              </td>
                            </>
                          )}
                          <td className="px-2 py-2 border-r border-slate-700/50">
                            <input
                              type="text"
                              value={item.beforeSubject}
                              onChange={e => updateItem("beforeSubject", e.target.value)}
                              onBlur={handleBlur}
                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-700/50">→</td>
                          <td className="px-2 py-2 border-r border-slate-700/50">
                            <input
                              type="text"
                              value={item.afterSubject}
                              onChange={e => updateItem("afterSubject", e.target.value)}
                              onBlur={handleBlur}
                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => {
                                setElectiveChanges(prev => {
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
                              }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors" title="같은 학생 과목 추가">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => {
                                setElectiveChanges(prev => ({
                                  ...prev,
                                  [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                                }));
                              }} className="p-1 text-slate-300 hover:text-red-400 transition-colors" title="삭제">
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
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
            <h3 className="font-semibold text-emerald-300">인원 균등 분배를 위한 임의 변경</h3>
          </div>
          <div className="overflow-auto relative">
            <table className="w-full text-sm text-left text-slate-300 border-collapse">
              <thead className="text-xs text-slate-300 bg-slate-800 border-b border-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-3 font-semibold text-center w-12 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">순번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">학번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">이름</th>
                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경전</th>
                  <th className="px-2 py-3 font-semibold text-center w-8 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">→</th>
                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경후</th>
                  <th className="px-2 py-3 font-semibold text-center w-12 sticky top-0 z-10 bg-slate-800 shadow-sm">
                    <button onClick={() => {
                      setElectiveChangesArbitrary(prev => ({
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
                    }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors">
                      <Plus className="w-5 h-5 mx-auto" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const data = electiveChangesArbitrary[changeActiveGrade];
                  const sortedData = [...data].sort((a, b) => {
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
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-300">
                          등록된 선택과목 변경 신청 내역이 없습니다.<br />
                          우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                        </td>
                      </tr>
                    );
                  }

                  const groupedData: any[] = [];
                  sortedData.forEach(item => {
                    const lastGroup = groupedData[groupedData.length - 1];
                    if (lastGroup && lastGroup.studentId === item.studentId && lastGroup.studentId !== "") {
                      lastGroup.items.push(item);
                    } else {
                      groupedData.push({ studentId: item.studentId, items: [item] });
                    }
                  });

                  let globalIndex = 0;
                  return groupedData.map((group: any, groupIdx: number) => {
                    return group.items.map((item: any, itemIdx: number) => {
                      const currentIndex = globalIndex++;
                      const isFirstInGroup = itemIdx === 0;
                      const rowSpan = group.items.length;

                      const updateItem = (field: string, value: string) => {
                        setElectiveChangesArbitrary(prev => {
                          const newData = [...prev[changeActiveGrade]];
                          const index = newData.findIndex(x => x.id === item.id);
                          if (index > -1) newData[index] = { ...newData[index], [field]: value };
                          return { ...prev, [changeActiveGrade]: newData };
                        });
                      };

                      const handleBlur = () => {
                        setElectiveChangesArbitrary(prev => {
                          const newData = [...prev[changeActiveGrade]];
                          let modified = false;
                          group.items.forEach((gItem: any) => {
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
                        <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                          <td className="px-3 py-2 text-center border-r border-slate-700/50 text-slate-300">{currentIndex + 1}</td>
                          {isFirstInGroup && (
                            <>
                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                <input
                                  type="text"
                                  value={item.studentId}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setElectiveChangesArbitrary(prev => {
                                      const newData = [...prev[changeActiveGrade]];
                                      group.items.forEach((gItem: any) => {
                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                        if (idx > -1) newData[idx] = { ...newData[idx], studentId: val };
                                      });
                                      return { ...prev, [changeActiveGrade]: newData };
                                    });
                                  }}
                                  onBlur={handleBlur}
                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                  placeholder="학번"
                                />
                              </td>
                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                <input
                                  type="text"
                                  value={item.studentName}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setElectiveChangesArbitrary(prev => {
                                      const newData = [...prev[changeActiveGrade]];
                                      group.items.forEach((gItem: any) => {
                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                        if (idx > -1) newData[idx] = { ...newData[idx], studentName: val };
                                      });
                                      return { ...prev, [changeActiveGrade]: newData };
                                    });
                                  }}
                                  onBlur={handleBlur}
                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                  placeholder="이름"
                                />
                              </td>
                            </>
                          )}
                          <td className="px-2 py-2 border-r border-slate-700/50">
                            <input
                              type="text"
                              value={item.beforeSubject}
                              onChange={e => updateItem("beforeSubject", e.target.value)}
                              onBlur={handleBlur}
                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-700/50">→</td>
                          <td className="px-2 py-2 border-r border-slate-700/50">
                            <input
                              type="text"
                              value={item.afterSubject}
                              onChange={e => updateItem("afterSubject", e.target.value)}
                              onBlur={handleBlur}
                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => {
                                setElectiveChangesArbitrary(prev => {
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
                              }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors" title="같은 학생 과목 추가">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => {
                                setElectiveChangesArbitrary(prev => ({
                                  ...prev,
                                  [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                                }));
                              }} className="p-1 text-slate-300 hover:text-red-400 transition-colors" title="삭제">
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
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner flex flex-col h-full">
          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-emerald-400">자동 변경 결과 내역</h3>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableOptimization}
                  onChange={(e) => setEnableOptimization(e.target.checked)}
                  className="form-checkbox rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                인원 균등화 최적화 알고리즘
              </label>
            </div>
            <button
              onClick={handleExportChanges}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-md transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              엑셀 다운로드
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left text-slate-300 border-collapse">
              <thead className="text-xs text-slate-300 bg-slate-800/50 border-b border-slate-700 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">학번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">이름</th>
                  <th className="px-4 py-3 font-semibold text-center sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">변경 내역</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const data = electiveChanges[changeActiveGrade] || [];
                  const dataLower = electiveChangesArbitrary[changeActiveGrade] || [];

                  if (data.length === 0 && dataLower.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-300">
                          신청 내역을 입력하면 자동 변경 결과가 이곳에 표시됩니다.
                        </td>
                      </tr>
                    );
                  }

                  const studentsUpper = Array.from(new Set(data.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));
                  const studentsLower = Array.from(new Set(dataLower.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

                  if (studentsUpper.length === 0 && studentsLower.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-300">
                          유효한 학번이 입력되지 않았습니다.
                        </td>
                      </tr>
                    );
                  }

                  const renderSection = (students: string[], source: 'applicant' | 'arbitrary', title: string, originalData: any[]) => {
                    if (students.length === 0) return null;

                    const rows = students.map(studentId => {
                      const logs = adjustmentLog[studentId] || [];
                      const filteredLogs = logs.filter(l => l.source === source);
                      if (filteredLogs.length === 0) return null;

                      const studentName = originalData.find(d => d.studentId === studentId)?.studentName || "";

                      return (
                        <tr key={studentId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                          <td className="px-4 py-3 text-center border-r border-slate-700/50 font-medium">{studentId}</td>
                          <td className="px-4 py-3 text-center border-r border-slate-700/50">{studentName}</td>
                          <td className="px-4 py-3">
                            {filteredLogs.length > 0 ? (
                              <div className="space-y-1">
                                {filteredLogs.map((log, i) => (
                                  <div
                                    key={i}
                                    className={`inline-block px-2 py-1 rounded border text-xs mr-2 mb-1 ${log.status === 'success'
                                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                                        : 'text-rose-300 bg-rose-600/10 border-rose-500/20 cursor-help'
                                      }`}
                                    title={log.reason}
                                  >
                                    {log.beforeStr} → {log.afterStr}
                                    {log.status === 'failed' && <span className="ml-1 font-bold">(불가)</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs">일치하는 수강 명단 없음</span>
                            )}
                          </td>
                        </tr>
                      );
                    }).filter(Boolean);

                    if (rows.length === 0) return null;

                    return (
                      <>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 bg-slate-800/80 border-y border-slate-700/50 text-emerald-400 font-semibold text-sm">
                            {title}
                          </td>
                        </tr>
                        {rows}
                      </>
                    );
                  };

                  return (
                    <>
                      {renderSection(studentsUpper, 'applicant', '■ 변경 신청 결과 (신청자)', data)}
                      {renderSection(studentsLower, 'arbitrary', '■ 인원 균등 분배 임의 변경 결과', dataLower)}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
