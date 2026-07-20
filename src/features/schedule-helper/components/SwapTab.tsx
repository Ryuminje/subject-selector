"use client";

import { useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { parseClassInfo, cn } from "@/features/schedule-helper/lib/utils";
import { Search, X, Check, ArrowRightLeft, Star } from "lucide-react";

interface SearchResult {
  teacher: string;
  day?: string;
  period?: number;
  subject?: string;
  isSub?: boolean;
}

export default function SwapTab() {
  const { data, isBlocked } = useSchedule();
  const [selectedCell, setSelectedCell] = useState<{ teacher: string; day: string; period: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<{ swap: SearchResult[]; sub: SearchResult[] }>({ swap: [], sub: [] });

  if (!data) return null;

  const handleCellClick = (teacher: string, day: string, period: number) => {
    const row = data.tableData.find((r) => r.teacher === teacher);
    const classStr = row?.[day + period];
    if (!classStr) return;

    setSelectedCell({ teacher, day, period });

    const myInfo = parseClassInfo(classStr);
    if (!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") {
      setResults({ swap: [], sub: [] });
      setModalOpen(true);
      return;
    }

    const swapResults: SearchResult[] = [];
    const subResults: SearchResult[] = [];
    const myDept = data.teacherDepts[teacher];

    data.tableData.forEach((otherRow) => {
      if (otherRow.teacher === teacher) return;

      // Swap Logic
      data.days.forEach((dayName) => {
        data.periods.forEach((perNum) => {
          if (isBlocked(otherRow.teacher, dayName, perNum)) return;
          const otherStr = otherRow[dayName + perNum];
          if (otherStr) {
            const oInfo = parseClassInfo(otherStr);
            if (oInfo && oInfo.grade === myInfo.grade && oInfo.classNum === myInfo.classNum) {
              if (!otherRow[day + period] && !row[dayName + perNum]) {
                swapResults.push({
                  teacher: otherRow.teacher,
                  day: dayName,
                  period: perNum,
                  subject: oInfo.subject,
                });
              }
            }
          }
        });
      });

      // Sub Logic
      if (myInfo.isMovingClass && myDept) {
        const otherDept = data.teacherDepts[otherRow.teacher];
        if (otherDept === myDept && !otherRow[day + period] && !isBlocked(otherRow.teacher, day, period)) {
          subResults.push({ teacher: otherRow.teacher, isSub: true });
        }
      }
    });

    setResults({ swap: swapResults, sub: subResults });
    setModalOpen(true);
  };

  const selectedClassStr = selectedCell ? data.tableData.find((r) => r.teacher === selectedCell.teacher)?.[selectedCell.day + selectedCell.period] : null;
  const myInfo = parseClassInfo(selectedClassStr);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[75vh] relative">
        <table className="w-full border-collapse text-sm table-fixed">
          <thead className="bg-teal-600 text-white sticky top-0 z-20 shadow-md">
            <tr>
              <th rowSpan={2} className="p-2 border-r border-teal-500/50 sticky left-0 z-30 bg-teal-700 w-[85px] whitespace-nowrap overflow-hidden text-ellipsis text-xs sm:text-sm">교사명</th>
              {data.days.map((d) => (
                <th key={d} colSpan={data.periods.length} className="p-2 border border-teal-500/50">{d}</th>
              ))}
            </tr>
            <tr>
              {data.days.map((d) =>
                data.periods.map((p) => (
                  <th key={`${d}-${p}`} className="p-1 border border-teal-500/50 text-[10px]">{p}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {data.tableData.map((row) => {
              const isVisible = !selectedCell ||
                                row.teacher === selectedCell.teacher ||
                                results.swap.some(r => r.teacher === row.teacher) ||
                                results.sub.some(r => r.teacher === row.teacher);

              if (!isVisible) return null;

              return (
                <tr key={row.teacher} className="hover:bg-emerald-50 transition-colors">
                <td className="p-1 border border-slate-200 sticky left-0 z-10 bg-slate-50 font-bold border-r-2 border-r-teal-600 w-[85px] whitespace-nowrap overflow-hidden text-ellipsis text-center text-[11px] sm:text-xs">
                  {row.teacher}
                </td>
                {data.days.map((d) =>
                  data.periods.map((p, pi) => {
                    const classStr = row[d + p];
                    const info = parseClassInfo(classStr);
                    const isSelected = selectedCell?.teacher === row.teacher && selectedCell?.day === d && selectedCell?.period === p;
                    const isPartner = selectedCell && (
                      results.swap.some(r => r.teacher === row.teacher && r.day === d && r.period === p) ||
                      results.sub.some(r => r.teacher === row.teacher && r.day === d && r.period === p)
                    );

                    return (
                      <td
                        key={`${d}-${p}`}
                        onClick={() => classStr && handleCellClick(row.teacher, d, p)}
                        className={cn(
                          "h-14 border border-slate-200 p-0.5 text-center align-middle transition-colors relative overflow-hidden",
                          pi === 0 && "border-l-2 border-l-slate-400",
                          classStr && "cursor-pointer hover:bg-amber-100",
                          isSelected && "bg-teal-100 border-2 border-teal-500 font-bold z-10",
                          isPartner && "bg-emerald-100 border-2 border-emerald-500 font-bold z-10"
                        )}
                      >
                        {info && (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate w-full block">
                              {info.subject.length > 5 ? info.subject.substring(0, 4) + ".." : info.subject}
                            </span>
                            {info.grade !== "?" && info.classNum !== "?" && (
                              <span className="text-[9px] sm:text-[10px] text-teal-700 font-bold bg-teal-500/10 px-1 py-0.5 rounded mt-0.5 inline-block truncate max-w-full">
                                {info.grade}-{info.classNum}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Panel */}
      {modalOpen && (
        <div className="fixed top-24 right-4 md:right-8 z-50 w-[320px] md:w-[400px] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-teal-200 overflow-hidden animate-in slide-in-from-right-8 duration-300">
          <div className="bg-teal-600 p-3 md:p-4 flex justify-between items-center text-white">
            <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
              <Search className="w-4 h-4 md:w-5 md:h-5" /> 수업 매칭 결과
            </h2>
            <button onClick={() => { setModalOpen(false); setSelectedCell(null); }} className="hover:bg-teal-500 p-1 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 md:p-6 max-h-[60vh] overflow-y-auto">
              {/* My Info */}
              <div className="bg-sky-50 p-4 rounded-2xl border-l-4 border-sky-500 mb-6">
                <div className="text-xs text-slate-500 font-medium mb-1">나의 선택 수업</div>
                <div className="text-base font-bold text-slate-800 flex items-center flex-wrap gap-2">
                  {selectedCell?.day}요일 {selectedCell?.period}교시 | {myInfo?.grade}학년 {myInfo?.classNum}반 {myInfo?.subject}
                  {myInfo?.isMovingClass && (
                    <span className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs ml-1">{myInfo.blockGroup}블록</span>
                  )}
                </div>
              </div>

              {(!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") ? (
                <div className="text-center p-6 text-rose-500 font-bold bg-rose-50 rounded-xl">
                  학반을 특정할 수 없는 수업입니다.
                </div>
              ) : (
                <div className="space-y-6">
                  {myInfo.isMovingClass && (
                    <div>
                      <h3 className="text-sm font-bold text-emerald-600 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 fill-emerald-600" /> 1순위 추천: 동과 대강 ({data.teacherDepts[selectedCell!.teacher]})
                      </h3>
                      {results.sub.length === 0 ? (
                        <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl">해당 시간에 공강인 동과 선생님이 없습니다.</div>
                      ) : (
                        <div className="space-y-2">
                          {results.sub.map((res, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 border border-emerald-100 bg-emerald-50 rounded-xl">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 font-bold" />
                              </div>
                              <div>
                                <div className="font-bold text-emerald-800 text-sm">{res.teacher} 선생님</div>
                                <div className="text-xs text-slate-600">해당 시간({selectedCell?.day} {selectedCell?.period}교시) <b>공강</b> · 대강 가능</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="border-b border-dashed border-slate-200 my-5"></div>
                      <h3 className="text-sm font-bold text-teal-600 mb-3 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" /> 2순위 추천: 일반 수업 교체
                      </h3>
                    </div>
                  )}

                  {!myInfo.isMovingClass && (
                    <h3 className="text-sm font-bold text-teal-600 mb-3 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" /> 일반 수업 교체
                    </h3>
                  )}

                  {results.swap.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-xl">
                      교체 가능한 대상이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.swap.map((res, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{res.teacher} 선생님</div>
                            <div className="text-xs text-slate-600"><b>{res.day}요일 {res.period}교시</b> · {res.subject}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
