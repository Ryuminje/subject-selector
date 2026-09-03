"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";
import { schoolName } from "@/config/hub";
import type { GradeKey, ProcessedStudent, SelectedSubjectHours, SubjectMap } from "../../../types";
import { CONFIRMATION_GRADE_LABEL, buildConfirmationDocx, downloadBlob } from "../lib/confirmationDocx";

interface ConfirmationDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGrade: GradeKey;
  students: ProcessedStudent[];
  selectedSubjectHours: SelectedSubjectHours[];
  subjectMap: SubjectMap;
}

const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 반/번호 문자열을 숫자 순으로 정렬합니다("10"이 "2" 앞에 오지 않게). */
const byNumeric = (a: string, b: string) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b);

// 학생별 수강신청 확인서(.docx) 다운로드 창.
// 학년도·서명 날짜는 문서에 그대로 찍히므로 내려받기 전에 고치게 하고, 반은 담임이 자기 반만
// 뽑는 경우가 많아 골라서 받을 수 있게 했습니다.
export function ConfirmationDownloadModal({
  isOpen,
  onClose,
  activeGrade,
  students,
  selectedSubjectHours,
  subjectMap,
}: ConfirmationDownloadModalProps) {
  const [schoolYear, setSchoolYear] = useState<number>(new Date().getFullYear());
  const [signDate, setSignDate] = useState<string>(todayIso);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.classNum).filter(Boolean))).sort(byNumeric),
    [students]
  );

  const targets = useMemo(() => {
    const picked = classFilter === "all" ? students : students.filter((s) => s.classNum === classFilter);
    // 반 → 번호 순으로 정렬해 두면 문서 페이지 순서가 곧 출석부 순서가 됩니다.
    return [...picked].sort((a, b) => byNumeric(a.classNum, b.classNum) || byNumeric(a.num, b.num));
  }, [students, classFilter]);

  if (!isOpen) return null;

  const gradeLabel = CONFIRMATION_GRADE_LABEL[activeGrade];

  const handleDownload = async () => {
    if (targets.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await buildConfirmationDocx({
        schoolName,
        grade: activeGrade,
        schoolYear,
        signDate,
        students: targets,
        selectedSubjectHours,
        subjectMap,
      });
      const scope = classFilter === "all" ? "전체" : `${classFilter}반`;
      downloadBlob(blob, `${schoolYear}학년도_${gradeLabel}_수강신청확인서_${scope}.docx`);
      onClose();
    } catch (e) {
      console.error(e);
      setError("문서를 만드는 중 오류가 났습니다. 교육과정 편성표(1단계)가 올라가 있는지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-stone-300 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-stone-200 bg-stone-100">
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <FileDown className="w-5 h-5 text-emerald-700" /> {gradeLabel} 수강신청 확인서 다운로드
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900 transition-colors" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-stone-600">
            학생 한 명당 한 페이지씩 담긴 Word 파일(.docx)로 내려받습니다. 본인이 신청한 선택과목이 교과군·학점과
            함께 표로 들어가고(학교 지정 과목 제외), 확인 사항과 서명란이 붙습니다.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-stone-600 mb-1">학년도</span>
              <input
                type="number"
                value={schoolYear}
                onChange={(e) => setSchoolYear(Number(e.target.value) || schoolYear)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-stone-600 mb-1">서명 날짜</span>
              <input
                type="date"
                value={signDate}
                onChange={(e) => setSignDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-stone-600 mb-1">대상 반</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            >
              <option value="all">전체 ({students.length}명)</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}반 ({students.filter((s) => s.classNum === c).length}명)
                </option>
              ))}
            </select>
          </label>

          {selectedSubjectHours.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              이 학년의 교육과정 편성표(1단계)가 없어 교과군·학점 칸이 비어 나갑니다.
            </p>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-stone-200 bg-stone-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors">
            취소
          </button>
          <button
            onClick={handleDownload}
            disabled={busy || targets.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {targets.length}명 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
