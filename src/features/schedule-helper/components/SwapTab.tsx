"use client";

import { useEffect, useRef, useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import { parseClassInfo, cn } from "@/features/schedule-helper/lib/utils";
import { Search, X, Check, ArrowRightLeft, Star, Pin } from "lucide-react";

interface SearchResult {
  teacher: string;
  day?: string;
  period?: number;
  subject?: string;
  isSub?: boolean;
}

interface ChainResult {
  // 나 → B: 내 수업을 B 선생님의 수업과 교체 (2순위 교체와 동일한 조건)
  b: { teacher: string; day: string; period: number; subject: string };
  // B가 지금 이 시간(선택한 셀)에 이미 가진 수업 — 이것 때문에 B가 바로는 교체를 못 받음
  w: { subject: string };
  // B ↔ C: B의 w 수업을 C와 교체해서 B를 이 시간에 비워줌
  c: { teacher: string; day: string; period: number; subject: string };
}

export default function SwapTab() {
  const { data, isBlocked, isSubjectBlocked, isTeacherBlocked } = useSchedule();
  const { data: session } = useSession();
  const [selectedCell, setSelectedCell] = useState<{ teacher: string; day: string; period: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<{ swap: SearchResult[]; sub: SearchResult[]; chain: ChainResult[] }>({ swap: [], sub: [], chain: [] });
  const [selectedChainIdx, setSelectedChainIdx] = useState<number | null>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [stickyTop, setStickyTop] = useState(0);

  // 로그인한 계정 이름과 일치하는 교사 행을 "내 시간표"로 맨 위에 고정하기 위해,
  // 헤더(sticky) 높이만큼 아래로 sticky 위치를 잡아줍니다.
  useEffect(() => {
    if (theadRef.current) setStickyTop(theadRef.current.getBoundingClientRect().height);
  }, [data]);

  if (!data) return null;

  const myName = session?.user?.name;
  const myRow = myName ? data.tableData.find((r) => r.teacher === myName) : undefined;

  const handleCellClick = (teacher: string, day: string, period: number) => {
    const row = data.tableData.find((r) => r.teacher === teacher);
    const classStr = row?.[day + period];
    if (!classStr) return;

    setSelectedCell({ teacher, day, period });
    setSelectedChainIdx(null);

    if (isTeacherBlocked(teacher)) {
      setResults({ swap: [], sub: [], chain: [] });
      setModalOpen(true);
      return;
    }

    const myInfo = parseClassInfo(classStr);
    if (!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") {
      setResults({ swap: [], sub: [], chain: [] });
      setModalOpen(true);
      return;
    }

    const swapResults: SearchResult[] = [];
    const subResults: SearchResult[] = [];
    const myDept = data.teacherDepts[teacher];
    // 과목 자체가 교체 금지 목록에 있으면 시간을 옮기는 교체(1단계/2단계)는 아예 검색하지 않습니다.
    // 동과 대강은 시간 이동이 없으므로(사람만 바뀜) 과목 금지와 무관하게 정상 동작해야 합니다.
    const subjectBlocked = isSubjectBlocked(myInfo.subject);

    data.tableData.forEach((otherRow) => {
      if (otherRow.teacher === teacher) return;
      if (isTeacherBlocked(otherRow.teacher)) return;

      // Swap Logic
      if (!subjectBlocked) {
        data.days.forEach((dayName) => {
          data.periods.forEach((perNum) => {
            if (isBlocked(otherRow.teacher, dayName, perNum)) return;
            const otherStr = otherRow[dayName + perNum];
            if (otherStr) {
              const oInfo = parseClassInfo(otherStr);
              if (oInfo && oInfo.grade === myInfo.grade && oInfo.classNum === myInfo.classNum && !isSubjectBlocked(oInfo.subject)) {
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
      }

      // Sub Logic
      if (myInfo.isMovingClass && myDept) {
        const otherDept = data.teacherDepts[otherRow.teacher];
        if (otherDept === myDept && !otherRow[day + period] && !isBlocked(otherRow.teacher, day, period)) {
          subResults.push({ teacher: otherRow.teacher, isSub: true });
        }
      }
    });

    // 1단계(직접 교체) 대상이 없을 때만, 2단계(연쇄 교체) 후보를 찾습니다.
    // B가 나와 같은 반(myInfo)을 다른 시간(dayB,perB)에 가르치고 내가 그 시간에 비어있지만,
    // B가 지금 이 시간(day,period)에 이미 다른 수업(w)이 있어서 막히는 경우 —
    // w와 같은 반을 가르치는 C를 찾아 B↔C를 먼저 교체하면 B가 이 시간에 비게 되어 나↔B 교체가 가능해집니다.
    const chainResults: ChainResult[] = [];
    if (swapResults.length === 0 && !subjectBlocked) {
      outer: for (const bRow of data.tableData) {
        if (bRow.teacher === teacher) continue;
        if (isTeacherBlocked(bRow.teacher)) continue;
        for (const dayB of data.days) {
          for (const perB of data.periods) {
            if (isBlocked(bRow.teacher, dayB, perB)) continue;
            const bStr = bRow[dayB + perB];
            if (!bStr) continue;
            const bInfo = parseClassInfo(bStr);
            if (!bInfo || bInfo.grade !== myInfo.grade || bInfo.classNum !== myInfo.classNum) continue;
            if (isSubjectBlocked(bInfo.subject)) continue;
            if (row[dayB + perB]) continue; // 내가 그 시간에 비어있어야 함
            if (isBlocked(bRow.teacher, day, period)) continue;

            const wStr = bRow[day + period];
            if (!wStr) continue; // B가 이미 이 시간에 비어있으면 1단계로 해결됨 (여기 올 일 없음)
            const wInfo = parseClassInfo(wStr);
            if (!wInfo || wInfo.grade === "?" || wInfo.classNum === "?") continue;
            if (isSubjectBlocked(wInfo.subject)) continue;

            for (const cRow of data.tableData) {
              if (cRow.teacher === teacher || cRow.teacher === bRow.teacher) continue;
              if (isTeacherBlocked(cRow.teacher)) continue;
              for (const dayC of data.days) {
                for (const perC of data.periods) {
                  if (isBlocked(cRow.teacher, dayC, perC)) continue;
                  const cStr = cRow[dayC + perC];
                  if (!cStr) continue;
                  const cInfo = parseClassInfo(cStr);
                  if (!cInfo || cInfo.grade !== wInfo.grade || cInfo.classNum !== wInfo.classNum) continue;
                  if (isSubjectBlocked(cInfo.subject)) continue;
                  if (bRow[dayC + perC]) continue; // B가 그 시간에 비어있어야 함
                  if (cRow[day + period]) continue; // C가 이 시간에 비어있어야 함
                  if (isBlocked(cRow.teacher, day, period)) continue;

                  chainResults.push({
                    b: { teacher: bRow.teacher, day: dayB, period: perB, subject: bInfo.subject },
                    w: { subject: wInfo.subject },
                    c: { teacher: cRow.teacher, day: dayC, period: perC, subject: cInfo.subject },
                  });
                  if (chainResults.length >= 6) break outer;
                }
              }
            }
          }
        }
      }
    }

    setResults({ swap: swapResults, sub: subResults, chain: chainResults });
    setModalOpen(true);
  };

  const selectChain = (idx: number) => {
    setSelectedChainIdx((prev) => (prev === idx ? null : idx));
  };

  const selectedClassStr = selectedCell ? data.tableData.find((r) => r.teacher === selectedCell.teacher)?.[selectedCell.day + selectedCell.period] : null;
  const myInfo = parseClassInfo(selectedClassStr);

  const renderRow = (row: typeof data.tableData[number], pinned: boolean) => (
    <tr
      key={row.teacher}
      className={cn("transition-colors", pinned ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-emerald-50")}
      style={pinned ? { position: "sticky", top: stickyTop, zIndex: 15 } : undefined}
    >
      <td
        className={cn(
          "p-1 border sticky left-0 z-10 font-bold border-r-2 border-r-teal-600 w-[85px] whitespace-nowrap overflow-hidden text-ellipsis text-center text-[11px] sm:text-xs",
          pinned ? "bg-amber-100 border-slate-200" : "bg-slate-50 border-slate-200"
        )}
      >
        {pinned ? (
          <span className="inline-flex items-center gap-0.5 text-amber-800">
            <Pin className="w-3 h-3 shrink-0" /> {row.teacher}
          </span>
        ) : (
          row.teacher
        )}
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
          const selectedChain = selectedChainIdx !== null ? results.chain[selectedChainIdx] : undefined;
          // 1단계(B↔C 교체): B의 지금 시간(w) ↔ C의 원래 시간
          const isChainStep1 = !!selectedChain && !!selectedCell && (
            (row.teacher === selectedChain.b.teacher && d === selectedCell.day && p === selectedCell.period) ||
            (row.teacher === selectedChain.c.teacher && d === selectedChain.c.day && p === selectedChain.c.period)
          );
          // 2단계(나↔B 교체): B의 원래 시간으로 내가 이동
          const isChainStep2 = !!selectedChain && row.teacher === selectedChain.b.teacher && d === selectedChain.b.day && p === selectedChain.b.period;

          return (
            <td
              key={`${d}-${p}`}
              onClick={() => classStr && handleCellClick(row.teacher, d, p)}
              className={cn(
                "h-14 border border-slate-200 p-0.5 text-center align-middle transition-colors relative overflow-hidden",
                pi === 0 && "border-l-2 border-l-slate-400",
                classStr && "cursor-pointer hover:bg-amber-100",
                isSelected && "bg-teal-100 border-2 border-teal-500 font-bold z-10",
                isPartner && "bg-emerald-100 border-2 border-emerald-500 font-bold z-10",
                isChainStep1 && "bg-orange-100 border-2 border-orange-500 font-bold z-10",
                isChainStep2 && "bg-purple-100 border-2 border-purple-500 font-bold z-10"
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

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <div className="flex-1 min-w-0 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[75vh] relative">
        <table className="w-full border-collapse text-sm table-fixed">
          <thead ref={theadRef} className="bg-teal-600 text-white sticky top-0 z-20 shadow-md">
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
            {myRow && renderRow(myRow, true)}
            {data.tableData.map((row) => {
              if (row.teacher === myName) return null;

              const isVisible = !selectedCell ||
                                row.teacher === selectedCell.teacher ||
                                results.swap.some(r => r.teacher === row.teacher) ||
                                results.sub.some(r => r.teacher === row.teacher) ||
                                results.chain.some(ch => ch.b.teacher === row.teacher || ch.c.teacher === row.teacher);

              if (!isVisible) return null;

              return renderRow(row, false);
            })}
          </tbody>
        </table>
      </div>
    </div>

      {/* Docked Panel */}
      {modalOpen && (
        <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-24 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-teal-200 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-teal-600 p-3 md:p-4 flex justify-between items-center text-white">
            <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
              <Search className="w-4 h-4 md:w-5 md:h-5" /> 수업 매칭 결과
            </h2>
            <button onClick={() => { setModalOpen(false); setSelectedCell(null); setSelectedChainIdx(null); }} className="hover:bg-teal-500 p-1 rounded-full transition-colors">
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

              {selectedCell && isTeacherBlocked(selectedCell.teacher) ? (
                <div className="text-center p-8 text-rose-600 font-bold bg-rose-50 rounded-xl">
                  이 교사는 관리자가 지정한 교체 금지 교사입니다. (교체·대강 모두 불가)
                </div>
              ) : (!myInfo || myInfo.grade === "?" || myInfo.classNum === "?") ? (
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

                  {isSubjectBlocked(myInfo.subject) ? (
                    <div className="text-center p-8 text-rose-600 font-bold bg-rose-50 rounded-xl">
                      &apos;{myInfo.subject}&apos; 과목은 교체가 금지되어 있습니다.
                    </div>
                  ) : results.swap.length === 0 ? (
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

                  {results.swap.length === 0 && results.chain.length > 0 && (
                    <div className="mt-2">
                      <div className="border-b border-dashed border-slate-200 mb-5"></div>
                      <h3 className="text-sm font-bold text-purple-600 mb-1 flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4" /> 2단계 교체 (연쇄 교체)
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        바로 교체할 상대가 없어, 두 번의 교체를 연결하면 가능한 조합을 찾았습니다. 원하는 조합을 선택하세요.
                      </p>
                      <div className="space-y-2">
                        {results.chain.map((ch, i) => (
                          <div
                            key={i}
                            onClick={() => selectChain(i)}
                            className={cn(
                              "p-3 border rounded-xl cursor-pointer transition-colors text-xs text-slate-700 space-y-1",
                              selectedChainIdx === i ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400" : "border-slate-100 hover:bg-slate-50"
                            )}
                          >
                            <div><b className="text-orange-600">1단계</b> {ch.b.teacher} ↔ {ch.c.teacher} 교체 — {ch.c.day}요일 {ch.c.period}교시 {ch.c.subject} ↔ (지금시간) {ch.w.subject}</div>
                            <div><b className="text-purple-700">2단계</b> 나 ↔ {ch.b.teacher} 교체 — {ch.b.day}요일 {ch.b.period}교시 {ch.b.subject}</div>
                          </div>
                        ))}
                      </div>

                      {selectedChainIdx !== null && (
                        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-500">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> 1단계 이동</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-400 inline-block" /> 2단계 이동</span>
                          <span className="text-slate-400 font-normal">— 아래 시간표에서 확인하세요</span>
                        </div>
                      )}
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
