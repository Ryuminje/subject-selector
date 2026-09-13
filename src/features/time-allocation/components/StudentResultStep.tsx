"use client";

import React, { useState } from "react";
import { ClipboardCopy, Download, Users } from "lucide-react";
import type { TimeAllocationApi } from "../hooks/useTimeAllocation";
import { blockedBands, classKey, classLabel } from "../lib/bands";
import { studentRowsBySemester, studentsTSV, timeLabel, type StudentRowsContext } from "../lib/studentRows";
import { exportStudentTimesXlsx } from "../lib/exportExcel";
import { exportRiroschoolXlsx } from "../lib/exportRiroschool";

interface Props {
  api: TimeAllocationApi;
  fileLabel: string;
  /** 본조사 탭에 업로드된 원본 엑셀(data URL) — 리로스쿨용 내보내기에만 씁니다. */
  getMainFileData?: () => string | undefined;
}

export function StudentResultStep({ api, fileLabel, getMainFileData }: Props) {
  // 체크 해제됐지만 배치가 남은 과목(1학기 결과 등)까지 합쳐진 값을 씁니다.
  const { state, ctx, studentAssign: assign, numTimes, semesterKeys } = api;
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [msg, setMsg] = useState<string>("");

  if (!state.roster || !ctx || !assign) {
    return <p className="text-sm text-stone-500 py-8">타임 배정을 먼저 실행하세요.</p>;
  }

  const rosterSubjects = state.roster.subjects;
  const rowsCtx: StudentRowsContext = {
    numTimes,
    startLetter: state.startLetter,
    subjects: rosterSubjects,
    students: state.roster.students,
    semesterKeys,
    bySemester: ctx.bySemester,
  };
  const multiSemester = semesterKeys.length > 1;

  const copyTsv = async () => {
    try {
      await navigator.clipboard.writeText(studentsTSV(rowsCtx, assign));
      setMsg("복사되었습니다. 엑셀에 붙여넣으세요.");
    } catch {
      setMsg("클립보드 접근이 거부되었습니다.");
    }
  };

  const exportXlsx = () => {
    exportStudentTimesXlsx(rowsCtx, assign, `${fileLabel}_타임배정`);
    setMsg("엑셀 파일을 내려받았습니다.");
  };

  const exportRiro = () => {
    const data = getMainFileData?.();
    if (!data) {
      setMsg("본조사 탭에 업로드된 원본 엑셀이 없습니다. 본조사 탭에서 파일을 먼저 올리세요.");
      return;
    }
    try {
      const r = exportRiroschoolXlsx(data, rowsCtx, assign, `${fileLabel}_리로스쿨_업로드용`);
      setMsg(
        `리로스쿨용 엑셀을 내려받았습니다 (학생 ${r.rows}명 · ${r.filled}칸 채움` +
          (r.unassigned ? ` · 미배정 ${r.unassigned}칸은 원본 값 유지)` : ")"),
      );
    } catch (e) {
      console.error(e);
      setMsg((e as Error).message || "엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <Users className="w-6 h-6 text-amber-600 shrink-0" />
        학생별 결과
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportXlsx}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl"
        >
          <Download className="w-4 h-4" /> Excel 내보내기
        </button>
        <button
          onClick={exportRiro}
          title="본조사 원본 파일의 선택 표시(1)를 배정된 타임 문자로 바꿔 내려받습니다."
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl"
        >
          <Download className="w-4 h-4" /> 리로스쿨용 엑셀
        </button>
        <button
          onClick={copyTsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-semibold rounded-xl"
        >
          <ClipboardCopy className="w-4 h-4" /> TSV 복사
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={onlyUnassigned}
            onChange={(e) => setOnlyUnassigned(e.target.checked)}
          />
          미배정 학생만
        </label>
        {msg && <span className="text-sm text-stone-600">{msg}</span>}
      </div>

      <div className="overflow-auto border border-stone-200 rounded-xl">
        <table className="text-[11px] border-collapse whitespace-nowrap">
          <thead className="bg-stone-100">
            {multiSemester && (
              <tr>
                <th className="border border-stone-200 px-2 py-1" colSpan={4} />
                {semesterKeys.map((key) => (
                  <th key={key} className="border border-stone-200 px-2 py-1 bg-amber-50" colSpan={ctx.bySemester[key]?.ownTimes ?? numTimes}>
                    {key}
                  </th>
                ))}
                <th className="border border-stone-200 px-2 py-1" />
              </tr>
            )}
            <tr>
              <th className="border border-stone-200 px-2 py-1">순번</th>
              <th className="border border-stone-200 px-2 py-1">학번</th>
              <th className="border border-stone-200 px-2 py-1">반</th>
              <th className="border border-stone-200 px-2 py-1">이름</th>
              {semesterKeys.flatMap((key) =>
                Array.from({ length: ctx.bySemester[key]?.ownTimes ?? numTimes }, (_, t) => (
                  <th key={`${key}-${t}`} className="border border-stone-200 px-2 py-1">
                    {timeLabel({ startLetter: state.startLetter }, t)}
                  </th>
                )),
              )}
              <th className="border border-stone-200 px-2 py-1">미배정</th>
            </tr>
          </thead>
          <tbody>
            {state.roster.students.map((st, i) => {
              const u = assign.unassigned[i];
              if (onlyUnassigned && !u.length) return null;
              const bySem = studentRowsBySemester(rowsCtx, assign, i);
              // 학기별 로컬 타임 인덱스라 차단 목록도 학기별로 따로 둡니다 — 합쳐서 보면
              // 2학기의 막힌 t가 1학기의 같은 번호 칸까지 잘못 물들일 수 있습니다.
              const blockedBySem: Record<string, number[]> = {};
              semesterKeys.forEach((key) => {
                const info = ctx.bySemester[key];
                blockedBySem[key] = info ? blockedBands(st.id, info.common, info.bandTimes) : [];
              });
              return (
                <tr key={st.id + i}>
                  <td className="border border-stone-200 px-2 py-1 text-center">{st.no}</td>
                  <td className="border border-stone-200 px-2 py-1">{st.id}</td>
                  <td className="border border-stone-200 px-2 py-1 text-center">
                    {classLabel(classKey(st.id))}
                  </td>
                  <td className="border border-stone-200 px-2 py-1">{st.name}</td>
                  {semesterKeys.flatMap((key) =>
                    (bySem[key] ?? []).map((name, t) => (
                      <td
                        key={`${key}-${t}`}
                        className={`border border-stone-200 px-2 py-1 ${blockedBySem[key]?.includes(t) ? "bg-emerald-50" : ""}`}
                      >
                        {name}
                      </td>
                    )),
                  )}
                  <td className={`border border-stone-200 px-2 py-1 ${u.length ? "text-rose-600" : ""}`}>
                    {u.map((s) => rosterSubjects[s].name).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
