"use client";

// 기초자료 3단계 — 학생 명단. 입학년도별로 누적되는 전교생 명단(이전학번 · 진급학번 · 이름)을 한 번 올려 두면
// 수요조사·본조사·타임 배정·선택과목 변경 탭이 같이 씁니다. 전출·퇴학·전입은 여기서 상태로 관리합니다.

import { useMemo, useState } from "react";
import { GraduationCap, Trash2, Upload, UserPlus } from "lucide-react";
import { useYearData } from "../YearDataContext";
import {
  STUDENT_STATUSES,
  addTransferStudent,
  currentGradeOfCohort,
  isExcluded,
  mergeRoster,
  parseRosterText,
  parseRosterWorkbook,
  summarizeByCohort,
  type ParseRosterResult,
  type StudentStatus,
} from "../lib/roster";

const STATUS_STYLE: Record<StudentStatus, string> = {
  재학: "bg-white text-stone-700 border-stone-300",
  전출: "bg-rose-50 text-rose-700 border-rose-300",
  퇴학: "bg-rose-50 text-rose-700 border-rose-300",
  전입: "bg-sky-50 text-sky-700 border-sky-300",
};

const gradeLabel = (cohort: number, workYear: number) => {
  const g = currentGradeOfCohort(cohort, workYear);
  if (g >= 1 && g <= 3) return `현 ${g}학년`;
  return g <= 0 ? "예비 1학년(입학 예정)" : "졸업";
};

export function StudentRosterStep() {
  const { roster, setRoster, workYear } = useYearData();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [cohortFilter, setCohortFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [tf, setTf] = useState({ name: "", oldId: "", newId: "" });

  const summary = useMemo(() => summarizeByCohort(roster), [roster]);

  const register = (r: ParseRosterResult, source: string) => {
    if (r.rows.length === 0) {
      setMsg({ kind: "error", text: "읽을 수 있는 줄이 없습니다. 이전학번 · 진급학번 · 이름 순서로, 학번은 숫자 4자리 이상이어야 합니다." });
      return;
    }
    const m = mergeRoster(roster, r.rows, workYear);
    setRoster(m.roster);
    setText("");
    setMsg({
      kind: "ok",
      text:
        `${source}에서 ${r.rows.length}명을 읽었습니다 — 새 학생 ${m.added}명, 기존 학생 갱신 ${m.updated}명` +
        (r.sheets.length > 1 ? ` (시트 ${r.sheets.length}개: ${r.sheets.join(", ")})` : "") +
        (r.skipped || m.invalid ? ` · 건너뜀 ${r.skipped + m.invalid}줄(학번 형식 확인 필요)` : ""),
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      register(parseRosterWorkbook(await f.arrayBuffer()), f.name);
    } catch {
      setMsg({ kind: "error", text: "파일을 읽지 못했습니다. 엑셀(.xlsx/.xls) 또는 CSV 파일인지 확인해 주세요." });
    }
  };

  const setStatus = (key: string, status: StudentStatus) =>
    setRoster((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));

  const addTransfer = () => {
    const r = addTransferStudent(roster, tf, workYear);
    if (r.error) {
      setMsg({ kind: "error", text: r.error });
      return;
    }
    setRoster(r.roster);
    setTf({ name: "", oldId: "", newId: "" });
    setMsg({ kind: "ok", text: `전입생 ${tf.name.trim()}을(를) 명단에 추가했습니다.` });
  };

  const firstId = (s: { ids: { 1?: string; 2?: string; 3?: string } }) => s.ids[1] ?? s.ids[2] ?? s.ids[3] ?? "";
  const shown = roster
    .filter((s) => (cohortFilter === "all" || s.cohort === cohortFilter) && (statusFilter === "all" || s.status === statusFilter))
    .filter((s) => {
      const q = query.trim();
      return !q || s.name.includes(q) || Object.values(s.ids).some((id) => id?.includes(q));
    })
    .sort((a, b) => b.cohort - a.cohort || firstId(a).localeCompare(firstId(b)));
  const LIMIT = 500;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <GraduationCap className="w-6 h-6 text-emerald-700" />
        3단계: 학생 명단
      </h2>
      <p className="text-stone-600">
        전교생 명단을 <b>이전학번 · 진급학번 · 이름</b> 순서로 올려 두세요. 학년별로 시트가 나뉜 엑셀은 모든 시트를 읽고, 입학년도별로 쌓입니다(해마다 올리면 학번이 누적됩니다).
        전출·퇴학으로 표시한 학생은 다른 탭에서도 빠지고, 전입생은 추가하면 다른 탭에 나타납니다.
      </p>

      <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        작업 학년도 <b>{workYear}</b> 기준입니다({workYear}학년도 입학생 = 예비 1학년, {workYear - 1} = 현 1학년, {workYear - 2} = 현 2학년). 바꾸려면 1단계에서 수정하세요.
      </div>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 hover:border-emerald-400 rounded-xl p-6 cursor-pointer text-stone-700">
        <Upload className="w-5 h-5 text-emerald-700" />
        <span className="text-sm font-medium">엑셀 / CSV 파일 선택 (모든 시트를 읽습니다)</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      </label>
      <div className="text-center text-xs text-stone-500">또는 엑셀에서 복사해 붙여넣기 (이전학번 · 진급학번 · 이름)</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"20101\t30101\t가나다\n20102\t30102\t나다라"}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className={`text-sm ${msg?.kind === "error" ? "text-rose-600" : "text-emerald-700"}`}>{msg?.text}</div>
        <button
          onClick={() => register(parseRosterText(text), "붙여넣은 내용")}
          disabled={!text.trim()}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
        >
          붙여넣은 명단 추가
        </button>
      </div>

      <div className="border border-stone-200 rounded-xl p-4 bg-white/60 space-y-3">
        <div className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-sky-600" /> 전입생 추가
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={tf.name}
            onChange={(e) => setTf((p) => ({ ...p, name: e.target.value }))}
            placeholder="이름"
            className="w-32 px-2 py-1.5 border border-stone-300 rounded-lg text-sm"
          />
          <input
            value={tf.oldId}
            onChange={(e) => setTf((p) => ({ ...p, oldId: e.target.value }))}
            placeholder="올해 학번"
            className="w-32 px-2 py-1.5 border border-stone-300 rounded-lg text-sm"
          />
          <input
            value={tf.newId}
            onChange={(e) => setTf((p) => ({ ...p, newId: e.target.value }))}
            placeholder="진급학번(선택)"
            className="w-36 px-2 py-1.5 border border-stone-300 rounded-lg text-sm"
          />
          <button onClick={addTransfer} className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium">
            추가
          </button>
        </div>
        <p className="text-xs text-stone-500">
          과목 선택은 여기서 입력하지 않습니다. 추가하면 수강신청(본조사) 탭에서 「신청 입력 필요」로 나타나고 거기서 과목을 체크합니다.
        </p>
      </div>

      {roster.length > 0 && (
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-sm">
            {summary.map((c) => (
              <button
                key={c.cohort}
                onClick={() => setCohortFilter(cohortFilter === c.cohort ? "all" : c.cohort)}
                className={`px-3 py-1 rounded-lg border ${cohortFilter === c.cohort ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"}`}
              >
                {c.cohort}학년도 입학생 · {gradeLabel(c.cohort, workYear)} · {c.active}명
                {c.excluded > 0 && <span className="opacity-80"> (제외 {c.excluded})</span>}
                {c.transferred > 0 && <span className="opacity-80"> (전입 {c.transferred})</span>}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StudentStatus | "all")}
                className="px-2 py-1 border border-stone-300 rounded-lg bg-white"
              >
                <option value="all">상태: 전체</option>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름·학번 검색"
                className="w-36 px-2 py-1 border border-stone-300 rounded-lg bg-white"
              />
              <button
                onClick={() => window.confirm(`학생 명단 ${roster.length}명을 모두 지울까요? (되돌릴 수 없습니다)`) && (setRoster([]), setMsg(null))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-stone-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" /> 명단 지우기
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-100 text-stone-600 sticky top-0">
                <tr>
                  <th className="px-3 py-2">입학년도</th>
                  <th className="px-3 py-2">1학년 학번</th>
                  <th className="px-3 py-2">2학년 학번</th>
                  <th className="px-3 py-2">3학년 학번</th>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, LIMIT).map((s) => (
                  <tr key={s.key} className={`border-t border-stone-100 ${isExcluded(s) ? "bg-rose-50/50 text-stone-400" : ""}`}>
                    <td className="px-3 py-1.5">{s.cohort}</td>
                    <td className="px-3 py-1.5">{s.ids[1] ?? ""}</td>
                    <td className="px-3 py-1.5">{s.ids[2] ?? ""}</td>
                    <td className="px-3 py-1.5">{s.ids[3] ?? ""}</td>
                    <td className={`px-3 py-1.5 font-medium ${isExcluded(s) ? "line-through" : ""}`}>{s.name}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={s.status}
                        onChange={(e) => setStatus(s.key, e.target.value as StudentStatus)}
                        className={`px-2 py-0.5 border rounded-md text-xs ${STATUS_STYLE[s.status]}`}
                      >
                        {STUDENT_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => window.confirm(`${s.name} 학생을 명단에서 완전히 지울까요? (전출·퇴학은 삭제하지 말고 상태로 표시하세요)`) && setRoster((prev) => prev.filter((x) => x.key !== s.key))}
                        className="p-1 text-stone-400 hover:text-rose-600"
                        title="명단에서 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-stone-500">
              {shown.length}명 중 {Math.min(shown.length, LIMIT)}명 표시{shown.length > LIMIT ? " — 필터나 검색으로 좁혀 보세요." : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
