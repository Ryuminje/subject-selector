"use client";

import { CheckCircle2, Download, RotateCcw } from "lucide-react";
import { GradeTabs } from "./GradeTabs";
import { getClassRecommendation } from "../hooks/useDemandClassSummary";
import type { GradeKey, SubjectStat } from "../../../types";

interface ClassOpeningStepProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  handleExportStep5: () => void;
  subjectStats: { [key in GradeKey]: SubjectStat[] };
  standardClassSize: { [key in GradeKey]: number };
  setStandardClassSize: React.Dispatch<React.SetStateAction<{ [key in GradeKey]: number }>>;
  manualStep5Classes: { [key: string]: string };
  setManualStep5Classes: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  editingStep5Classes: { [key: string]: boolean };
  setEditingStep5Classes: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

export function ClassOpeningStep({
  activeGrade,
  setActiveGrade,
  handleExportStep5,
  subjectStats,
  standardClassSize,
  setStandardClassSize,
  manualStep5Classes,
  setManualStep5Classes,
  editingStep5Classes,
  setEditingStep5Classes,
}: ClassOpeningStepProps) {
  const stats = subjectStats[activeGrade] || [];
  const standardSize = standardClassSize[activeGrade] || 25;

  const groupTotals: Record<string, number> = {};
  stats.forEach(stat => {
    const baseRemark = getClassRecommendation(stat.applicants, standardSize);
    const key = `${activeGrade}_${stat.semester}_${stat.subject}`;
    const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;
    if (displayRemark !== "폐강" && !isNaN(Number(displayRemark))) {
      const groupKey = `${stat.group}군(${stat.semester})`;
      groupTotals[groupKey] = (groupTotals[groupKey] || 0) + Number(displayRemark);
    }
  });
  const groups = Object.keys(groupTotals).sort();

  const groupSpans: number[] = [];
  const semSpans: number[] = [];
  for (let idx = 0; idx < stats.length; idx++) {
    if (idx === 0 || stats[idx].group !== stats[idx - 1].group) {
      let count = 1;
      while (idx + count < stats.length && stats[idx + count].group === stats[idx].group) {
        count++;
      }
      groupSpans.push(count);
    } else {
      groupSpans.push(0);
    }

    if (idx === 0 || stats[idx].group !== stats[idx - 1].group || stats[idx].semester !== stats[idx - 1].semester) {
      let count = 1;
      while (idx + count < stats.length && stats[idx + count].group === stats[idx].group && stats[idx + count].semester === stats[idx].semester) {
        count++;
      }
      semSpans.push(count);
    } else {
      semSpans.push(0);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-indigo-400" />
          5단계: 과목 개설 여부 및 학급 분반 추천
        </h2>
        <button
          onClick={handleExportStep5}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
          disabled={subjectStats[activeGrade].length === 0}
        >
          <Download className="w-4 h-4" />
          {activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 개설 여부 엑셀 다운로드
        </button>
      </div>

      <GradeTabs activeGrade={activeGrade} setActiveGrade={setActiveGrade} />

      {/* 학급 기준 인원 설정 */}
      <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-200">학급 분반 및 개설 기준 설정</h3>
          <p className="text-xs text-slate-300 mt-1">
            설정된 학급 기준 인원에 따라 개설(70% 이상), 논의(70% 미만), 분반 추천(120% 초과) 및 폐강(10명 미만) 여부를 자동으로 판단합니다.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          {groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mr-2">
              {groups.map(grp => (
                <div key={grp} className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/50 px-2.5 py-1 rounded-lg shadow-inner">
                  <span className="text-[11px] font-semibold text-slate-300 tracking-wider">{grp}:</span>
                  <span className="text-[13px] font-bold text-indigo-400">{groupTotals[grp]}반</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              if (confirm("수동으로 조정한 개설 반 수를 모두 초기화하시겠습니까?")) {
                setManualStep5Classes(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => {
                    if (k.startsWith(`${activeGrade}_`)) {
                      delete next[k];
                    }
                  });
                  return next;
                });
              }
            }}
            className="px-3 py-1.5 ml-2 mr-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow-md"
            title="수동으로 조정한 개설 반 수를 모두 초기화합니다"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
            초기화
          </button>
          <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
            <label htmlFor="standardSizeInput" className="text-sm text-slate-300 font-medium whitespace-nowrap">학급 기준 인원:</label>
            <input
              id="standardSizeInput"
              type="number"
              min={10}
              max={50}
              value={standardClassSize[activeGrade]}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 25;
                setStandardClassSize(prev => ({ ...prev, [activeGrade]: val }));
              }}
              className="w-16 bg-slate-950 border border-slate-700 text-center rounded-lg px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300 whitespace-nowrap">명</span>
          </div>
        </div>
      </div>

      {subjectStats[activeGrade].length === 0 ? (
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-300">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
        </div>
      ) : (
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-auto max-h-[650px]">
            <table className="w-full text-sm text-left text-slate-300 border-collapse">
              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[100px]">선택군</th>
                  <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">학기</th>
                  <th className="px-6 py-3 border-r border-slate-800/60">과목</th>
                  <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">신청자 수</th>
                  <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">개설 반 수</th>
                  <th className="px-4 py-3 text-center min-w-[120px]">개설여부</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row, idx) => {
                  const baseRemark = getClassRecommendation(row.applicants, standardSize);
                  const key = `${activeGrade}_${row.semester}_${row.subject}`;
                  const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;

                  let openingStatus = "미정";
                  let openingStyle = "text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-md inline-block";

                  if (displayRemark === "폐강") {
                    openingStatus = "폐강";
                    openingStyle = "text-rose-400 font-bold bg-rose-600/10 px-2.5 py-1 rounded-md inline-block";
                  } else if (!isNaN(Number(displayRemark))) {
                    openingStatus = "확정";
                    openingStyle = "text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md inline-block";
                  }

                  const isEditable = displayRemark === "논의" || displayRemark.includes("~") || manualStep5Classes[key] !== undefined;

                  return (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors">
                      {groupSpans[idx] > 0 && (
                        <td
                          rowSpan={groupSpans[idx]}
                          className="px-4 py-3.5 text-center font-bold text-slate-200 border-r border-slate-800/50 bg-slate-950/60 align-middle"
                        >
                          {row.group}
                        </td>
                      )}
                      {semSpans[idx] > 0 && (
                        <td
                          rowSpan={semSpans[idx]}
                          className="px-4 py-3.5 text-center font-semibold text-slate-300 border-r border-slate-800/50 bg-slate-950/40 align-middle"
                        >
                          {row.semester}
                        </td>
                      )}
                      <td className="px-6 py-3.5 border-r border-slate-800/50 font-medium text-white">
                        {row.subject}
                      </td>
                      <td className="px-4 py-3.5 text-center border-r border-slate-800/50 font-semibold text-indigo-400">
                        {row.applicants}명
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle border-r border-slate-800/50">
                        {editingStep5Classes[key] ? (
                          <input
                            type="text"
                            autoFocus
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                            value={manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark}
                            onChange={(e) => setManualStep5Classes(p => ({ ...p, [key]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') setEditingStep5Classes(p => ({ ...p, [key]: false })) }}
                            onBlur={() => setEditingStep5Classes(p => ({ ...p, [key]: false }))}
                          />
                        ) : (
                          <span
                            className={isEditable ? "cursor-pointer hover:text-indigo-400 font-medium" : "text-slate-300 font-medium"}
                            onClick={() => { if (isEditable || true) setEditingStep5Classes(p => ({ ...p, [key]: true })) }}
                            title={isEditable || true ? "클릭하여 수동 입력" : undefined}
                          >
                            {displayRemark}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className={openingStyle}>{openingStatus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
