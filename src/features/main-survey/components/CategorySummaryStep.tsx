"use client";

import { FileText, Download } from "lucide-react";
import type { CategorySummaryRow } from "../hooks/useMainClassSummary";
import type { GradeKey } from "../../../types";

interface CategorySummaryStepProps {
  handleExportCategorySummary: () => void;
  categorySummaryData: CategorySummaryRow[];
  totalClasses: { [key in GradeKey]: number };
  setTotalClasses: React.Dispatch<React.SetStateAction<{ [key in GradeKey]: number }>>;
  setManualClassCounts: React.Dispatch<React.SetStateAction<{ [subjectKey: string]: number }>>;
  headTeacherCategoryInput: string;
  setHeadTeacherCategoryInput: (value: string) => void;
  headTeacherReductions: { [category: string]: number };
  setHeadTeacherReductions: React.Dispatch<React.SetStateAction<{ [category: string]: number }>>;
  teacherCounts: { [category: string]: number };
  setTeacherCounts: React.Dispatch<React.SetStateAction<{ [category: string]: number }>>;
  editingTeachers: { [category: string]: boolean };
  setEditingTeachers: React.Dispatch<React.SetStateAction<{ [category: string]: boolean }>>;
  manualClassCounts: { [subjectKey: string]: number };
  editingClasses: { [subjectKey: string]: boolean };
  setEditingClasses: React.Dispatch<React.SetStateAction<{ [subjectKey: string]: boolean }>>;
}

export function CategorySummaryStep({
  handleExportCategorySummary,
  categorySummaryData,
  totalClasses,
  setTotalClasses,
  setManualClassCounts,
  headTeacherCategoryInput,
  setHeadTeacherCategoryInput,
  headTeacherReductions,
  setHeadTeacherReductions,
  teacherCounts,
  setTeacherCounts,
  editingTeachers,
  setEditingTeachers,
  manualClassCounts,
  editingClasses,
  setEditingClasses,
}: CategorySummaryStepProps) {
  const totalSem1Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem1?.subjectHours || 0), 0);
  const totalSem2Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem2?.subjectHours || 0), 0);
  const totalYearHours = categorySummaryData.filter(r => r.isFirstRow).reduce((acc, row) => acc + row.yearTotal, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            교과(군)별 시수 정리
          </h2>
          <button
            onClick={handleExportCategorySummary}
            disabled={categorySummaryData.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
        </div>
        <div className="flex gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">1학년 전체 반:</span>
            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.pre1 || ""} onChange={e => {
              setTotalClasses(p => ({ ...p, pre1: Number(e.target.value) || 0 }));
              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("1_") && !k.endsWith("_split")) delete next[k]; }); return next; });
            }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">2학년 전체 반:</span>
            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.grade1 || ""} onChange={e => {
              setTotalClasses(p => ({ ...p, grade1: Number(e.target.value) || 0 }));
              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("2_") && !k.endsWith("_split")) delete next[k]; }); return next; });
            }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">3학년 전체 반:</span>
            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.grade2 || ""} onChange={e => {
              setTotalClasses(p => ({ ...p, grade2: Number(e.target.value) || 0 }));
              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("3_") && !k.endsWith("_split")) delete next[k]; }); return next; });
            }} />
          </div>
        </div>
        <div className="flex gap-2 bg-rose-900/20 p-3 rounded-xl border border-rose-800/40 items-center mt-4 md:mt-0">
          <span className="text-sm text-rose-300 font-medium">수석교사 감축 시수:</span>
          <select
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 w-28"
            value={headTeacherCategoryInput}
            onChange={e => setHeadTeacherCategoryInput(e.target.value)}
          >
            <option value="">교과 선택</option>
            {Array.from(new Set(categorySummaryData.filter(r => r.isFirstRow).map(r => r.category))).map(cat => (
              <option key={cat} value={cat}>
                {cat} {headTeacherReductions[cat] ? `(-${headTeacherReductions[cat]})` : ""}
              </option>
            ))}
          </select>
          {headTeacherCategoryInput && (
            <input
              type="number"
              placeholder="시수"
              className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200"
              value={headTeacherReductions[headTeacherCategoryInput] || ""}
              onChange={e => {
                const val = Number(e.target.value);
                setHeadTeacherReductions(p => {
                  const next = { ...p };
                  if (!val || val === 0) delete next[headTeacherCategoryInput];
                  else next[headTeacherCategoryInput] = val;
                  return next;
                });
              }}
            />
          )}
        </div>
      </div>
      <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden shadow-inner overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-300 bg-slate-900/80 sticky top-0 uppercase z-10 border-b border-slate-700/50">
            <tr>
              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교과</th>
              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교사 수</th>
              <th colSpan={7} className="px-4 py-3 text-center border-r border-slate-700/50 border-b border-slate-700/50">1학기</th>
              <th colSpan={7} className="px-4 py-3 text-center border-r border-slate-700/50 border-b border-slate-700/50">2학기</th>
              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교과별<br />1년 시수</th>
              <th rowSpan={2} className="px-4 py-3 text-center">교과별<br />1년 평균<br />(학기당 평균)</th>
            </tr>
            <tr>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">학년</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목명</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">운영학점</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">개설반</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목별 시수</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 총 시수</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 평균시수</th>

              <th className="px-4 py-2 text-center border-r border-slate-700/50">학년</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목명</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">운영학점</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">개설반</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목별 시수</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 총 시수</th>
              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 평균시수</th>
            </tr>
          </thead>
          <tbody className="">
            {categorySummaryData.length > 0 ? (
              categorySummaryData.map((row, idx) => {
                const bg1 = row.sem1 ? (row.sem1.isElective ? "bg-indigo-500/10" : "bg-emerald-500/10") : "";
                const bg2 = row.sem2 ? (row.sem2.isElective ? "bg-indigo-500/10" : "bg-emerald-500/10") : "";
                return (
                  <tr key={`${row.category}-${idx}`} className={`hover:bg-slate-800/30 transition-colors border-b border-slate-700/50 ${row.isFirstRow ? 'border-t-2 border-t-slate-600/80' : ''}`}>
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 font-medium align-middle">
                        {row.category}
                      </td>
                    )}
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 align-middle">
                        {editingTeachers[row.category] ? (
                          <input
                            type="number"
                            autoFocus
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                            value={teacherCounts[row.category] || ""}
                            onChange={(e) => setTeacherCounts(p => ({ ...p, [row.category]: Number(e.target.value) || 0 }))}
                            onKeyDown={e => { if (e.key === 'Enter') setEditingTeachers(p => ({ ...p, [row.category]: false })) }}
                            onBlur={() => setEditingTeachers(p => ({ ...p, [row.category]: false }))}
                            placeholder="0"
                          />
                        ) : (
                          <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingTeachers(p => ({ ...p, [row.category]: true }))} title="클릭하여 수동 입력">
                            {teacherCounts[row.category] || 0}
                          </span>
                        )}
                      </td>
                    )}

                    {/* 1학기 */}
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.gradeLabel || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-200 ${bg1}`}>{row.sem1?.subject || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.credits || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>
                      {row.sem1 ? (() => {
                        const key = `${row.sem1.gradeLabel}_${row.sem1.subject}_1${row.sem1.isSplit ? '_split' : ''}`;
                        const displayVal = manualClassCounts[key] !== undefined ? manualClassCounts[key] : row.sem1.classCount;

                        if (editingClasses[key]) {
                          return (
                            <input
                              type="number"
                              autoFocus
                              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                              value={manualClassCounts[key] !== undefined ? manualClassCounts[key] : ""}
                              onChange={(e) => setManualClassCounts(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                              onKeyDown={e => { if (e.key === 'Enter') setEditingClasses(p => ({ ...p, [key]: false })) }}
                              onBlur={() => setEditingClasses(p => ({ ...p, [key]: false }))}
                              placeholder={displayVal.toString()}
                            />
                          );
                        } else {
                          return (
                            <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingClasses(p => ({ ...p, [key]: true }))} title="클릭하여 수동 입력">
                              {displayVal || 0}
                            </span>
                          );
                        }
                      })() : ""}
                    </td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.subjectHours !== undefined ? row.sem1.subjectHours : ""}</td>
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 font-semibold align-middle">
                        {row.reduction > 0 ? (
                          <div className="flex flex-col items-center">
                            <span>{row.sem1Total}</span>
                            <span className="text-[10px] text-rose-400 font-normal opacity-80 mt-1">({row.sem1TotalOriginal}-{row.reduction})</span>
                          </div>
                        ) : (
                          row.sem1Total || 0
                        )}
                      </td>
                    )}
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-indigo-300 font-semibold align-middle">
                        {row.sem1Avg}
                      </td>
                    )}

                    {/* 2학기 */}
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.gradeLabel || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-200 ${bg2}`}>{row.sem2?.subject || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.credits || ""}</td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>
                      {row.sem2 ? (() => {
                        const key = `${row.sem2.gradeLabel}_${row.sem2.subject}_2${row.sem2.isSplit ? '_split' : ''}`;
                        const displayVal = manualClassCounts[key] !== undefined ? manualClassCounts[key] : row.sem2.classCount;

                        if (editingClasses[key]) {
                          return (
                            <input
                              type="number"
                              autoFocus
                              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                              value={manualClassCounts[key] !== undefined ? manualClassCounts[key] : ""}
                              onChange={(e) => setManualClassCounts(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                              onKeyDown={e => { if (e.key === 'Enter') setEditingClasses(p => ({ ...p, [key]: false })) }}
                              onBlur={() => setEditingClasses(p => ({ ...p, [key]: false }))}
                              placeholder={displayVal.toString()}
                            />
                          );
                        } else {
                          return (
                            <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingClasses(p => ({ ...p, [key]: true }))} title="클릭하여 수동 입력">
                              {displayVal || 0}
                            </span>
                          );
                        }
                      })() : ""}
                    </td>
                    <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.subjectHours !== undefined ? row.sem2.subjectHours : ""}</td>
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 font-semibold align-middle">
                        {row.reduction > 0 ? (
                          <div className="flex flex-col items-center">
                            <span>{row.sem2Total}</span>
                            <span className="text-[10px] text-rose-400 font-normal opacity-80 mt-1">({row.sem2TotalOriginal}-{row.reduction})</span>
                          </div>
                        ) : (
                          row.sem2Total || 0
                        )}
                      </td>
                    )}
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-indigo-300 font-semibold align-middle">
                        {row.sem2Avg}
                      </td>
                    )}

                    {/* 1년 시수 및 1년 평균 */}
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-emerald-300 font-bold align-middle">
                        {row.yearTotal || 0}
                      </td>
                    )}
                    {row.isFirstRow && (
                      <td rowSpan={row.rowSpan} className="px-4 py-3 text-center text-emerald-400 font-bold align-middle">
                        {row.yearAvg}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={18} className="px-4 py-8 text-center text-slate-300">
                  데이터가 없습니다. 1단계 교육과정 편성표를 업로드해주세요.
                </td>
              </tr>
            )}
            {categorySummaryData.length > 0 && (
              <tr className="bg-indigo-900/40 font-bold border-t-2 border-slate-600/80 hover:bg-indigo-900/60 transition-colors">
                <td colSpan={6} className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">총계</td>
                <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem1Hours}</td>
                <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem1Hours}</td>
                <td colSpan={5} className="px-4 py-4 border-r border-slate-700/50"></td>
                <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem2Hours}</td>
                <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem2Hours}</td>
                <td className="px-4 py-4 border-r border-slate-700/50"></td>
                <td className="px-4 py-4 text-center border-r border-slate-700/50 text-emerald-400 font-extrabold">{totalYearHours}</td>
                <td className="px-4 py-4 text-center text-emerald-400 font-extrabold"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
