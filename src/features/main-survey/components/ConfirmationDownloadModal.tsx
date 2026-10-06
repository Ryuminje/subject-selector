"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";
import { schoolName } from "@/config/hub";
import type { GradeKey, ProcessedStudent, SelectedSubjectHours, SubjectMap } from "../../../types";
import {
  CONFIRMATION_GRADE_LABEL,
  buildConfirmationDocx,
  canPickDirectory,
  downloadBlob,
  pickDirectory,
  saveBlobToDirectory,
} from "../lib/confirmationDocx";

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

/** 파일을 연달아 내려받을 때 브라우저가 앞 다운로드를 끊지 않도록 두는 간격(ms). */
const DOWNLOAD_GAP_MS = 400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 학생별 수강신청 확인서(.docx) 다운로드 창.
// 학년도·서명 날짜는 문서에 그대로 찍히므로 내려받기 전에 고치게 하고, 반은 담임이 자기 반만
// 뽑거나 여러 반을 반별 파일로 한꺼번에 받는 경우가 많아 골라서 받을 수 있게 했습니다.
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
  // 체크를 뺀 반을 기억합니다. "고른 반"으로 두면 학생 목록이 바뀔 때(다시 업로드) 반 목록과 어긋납니다.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [splitFiles, setSplitFiles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.classNum).filter(Boolean))).sort(byNumeric),
    [students]
  );

  const targets = useMemo(() => {
    const picked = students.filter((s) => !excluded.has(s.classNum));
    // 반 → 번호 순으로 정렬해 두면 문서 페이지 순서가 곧 출석부 순서가 됩니다.
    return [...picked].sort((a, b) => byNumeric(a.classNum, b.classNum) || byNumeric(a.num, b.num));
  }, [students, excluded]);

  // 반마다 한 파일로 나눌 때의 묶음(반 순서 유지).
  const groups = useMemo(() => {
    const byClass = new Map<string, ProcessedStudent[]>();
    for (const student of targets) {
      const list = byClass.get(student.classNum) ?? [];
      list.push(student);
      byClass.set(student.classNum, list);
    }
    return Array.from(byClass.entries());
  }, [targets]);

  if (!isOpen) return null;

  const gradeLabel = CONFIRMATION_GRADE_LABEL[activeGrade];
  const allPicked = excluded.size === 0;
  const fileCount = splitFiles ? groups.length : targets.length > 0 ? 1 : 0;

  const toggleClass = (classNum: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(classNum)) next.delete(classNum);
      else next.add(classNum);
      return next;
    });
  };

  const handleDownload = async () => {
    if (targets.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // 폴더 선택창은 버튼을 누른 직후에만 열 수 있어서(문서를 만드는 시간이 길면 거부됩니다)
      // 무엇보다 먼저 묻습니다. 창을 그냥 닫으면 다운로드도 하지 않습니다.
      let saveDir: FileSystemDirectoryHandle | null = null;
      if (canPickDirectory()) {
        saveDir = await pickDirectory();
        if (!saveDir) return;
      }

      const base = { schoolName, grade: activeGrade, schoolYear, signDate, selectedSubjectHours, subjectMap };
      const prefix = `${schoolYear}학년도_${gradeLabel}_수강신청확인서`;
      // 폴더를 골랐으면 그 폴더에 바로 쓰고, 고를 수 없는 환경이면 브라우저 다운로드로 내려보냅니다.
      const deliver = async (blob: Blob, fileName: string) => {
        if (saveDir) await saveBlobToDirectory(saveDir, blob, fileName);
        else downloadBlob(blob, fileName);
      };

      if (splitFiles) {
        for (let i = 0; i < groups.length; i += 1) {
          const [classNum, list] = groups[i];
          setProgress(`${i + 1}/${groups.length}`);
          const blob = await buildConfirmationDocx({ ...base, students: list });
          await deliver(blob, `${prefix}_${classNum ? `${classNum}반` : "반미지정"}.docx`);
          if (!saveDir && i < groups.length - 1) await wait(DOWNLOAD_GAP_MS);
        }
      } else {
        const blob = await buildConfirmationDocx({ ...base, students: targets });
        const scope = allPicked ? "전체" : `${groups.map(([c]) => c).join("·")}반`;
        await deliver(blob, `${prefix}_${scope}.docx`);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError("문서를 만드는 중 오류가 났습니다. 교육과정 편성표(1단계)가 올라가 있는지 확인해 주세요.");
    } finally {
      setBusy(false);
      setProgress("");
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-stone-600">
                대상 반 <span className="font-normal text-stone-400">({targets.length}/{students.length}명)</span>
              </span>
              <button
                type="button"
                onClick={() => setExcluded(allPicked ? new Set(classes) : new Set())}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                {allPicked ? "모두 해제" : "모두 선택"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 -m-1">
              {classes.map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                    excluded.has(c)
                      ? "bg-white border-stone-200 text-stone-400"
                      : "bg-emerald-50 border-emerald-200 text-stone-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!excluded.has(c)}
                    onChange={() => toggleClass(c)}
                    className="accent-emerald-600"
                  />
                  {c}반 <span className="text-xs text-stone-500">({students.filter((s) => s.classNum === c).length}명)</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-stone-500">
            {canPickDirectory()
              ? "다운로드를 누르면 저장할 폴더를 고르는 창이 열립니다."
              : "이 브라우저·주소에서는 폴더를 고르는 창을 쓸 수 없어 기본 다운로드 폴더로 저장됩니다. (크롬·엣지에서 https 또는 localhost 주소로 열면 쓸 수 있고, 브라우저 설정의 \"다운로드 전에 저장 위치 묻기\"를 켜도 매번 위치를 고를 수 있습니다.)"}
          </p>

          <label className="flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={splitFiles}
              onChange={(e) => setSplitFiles(e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            <span>
              반마다 파일 따로 받기
              <span className="block text-xs text-stone-500">
                끄면 고른 반을 한 파일에 이어 담습니다. 여러 파일이 내려올 때 브라우저가 &quot;여러 파일 다운로드를
                허용할까요?&quot;라고 물으면 허용해 주세요.
              </span>
            </span>
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
            {busy && progress
              ? `${progress} 만드는 중`
              : fileCount > 1
                ? `${targets.length}명 · 파일 ${fileCount}개 다운로드`
                : `${targets.length}명 다운로드`}
          </button>
        </div>
      </div>
    </div>
  );
}
