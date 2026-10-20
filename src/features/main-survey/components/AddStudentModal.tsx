"use client";

import { useMemo, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { normalizeSubjectName } from "../hooks/useMainUploads";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 이 학년에 업로드된 원본 행 — 선택 가능한 "그룹::과목" 열 목록을 여기서 뽑는다 */
  rawRows: Record<string, unknown>[];
  /** 성공하면 null, 실패하면 이유를 돌려준다 */
  onAdd: (studentId: string, name: string, selectedKeys: string[]) => string | null;
}

export function AddStudentModal({ isOpen, onClose, rawRows, onAdd }: AddStudentModalProps) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState("");

  // 같은 묶음(상위 헤더)끼리 모아서 보여준다. 열 순서는 업로드한 엑셀 그대로.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; subject: string }[]>();
    rawRows.forEach(r => Object.keys(r).forEach(k => {
      if (!k.includes("::")) return;
      const [parent, subject] = k.split("::");
      const list = map.get(parent) ?? [];
      if (!list.some(x => x.key === k)) list.push({ key: k, subject: subject.trim() });
      map.set(parent, list);
    }));
    return Array.from(map.entries());
  }, [rawRows]);

  if (!isOpen) return null;

  const subjectOf = (key: string) => normalizeSubjectName(key.split("::")[1] ?? "");
  const checkedSubjects = new Set(checked.map(subjectOf));

  const toggle = (key: string) => {
    setChecked(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const close = () => {
    setStudentId(""); setName(""); setChecked([]); setError("");
    onClose();
  };

  const submit = () => {
    const err = onAdd(studentId, name, checked);
    if (err) { setError(err); return; }
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-700" /> 전입생 추가
          </h3>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-auto space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-stone-700">
              학번
              <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="예: 20317"
                className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            <label className="text-sm text-stone-700">
              이름
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-stone-600">신청한 과목을 체크해 주세요. 같은 과목은 한 번만 선택할 수 있습니다.</p>
            {groups.length === 0 && <p className="text-sm text-stone-500">선택할 과목이 없습니다. 먼저 수강신청 엑셀을 업로드해 주세요.</p>}
            {groups.map(([parent, items]) => (
              <div key={parent} className="border border-stone-200 rounded-xl p-3">
                <div className="text-sm font-semibold text-stone-800 mb-2">{parent}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map(({ key, subject }) => {
                    const on = checked.includes(key);
                    // 다른 묶음에서 이미 고른 같은 과목이면 막는다
                    const blocked = !on && checkedSubjects.has(normalizeSubjectName(subject));
                    return (
                      <label key={key} title={blocked ? "이미 선택한 과목입니다" : undefined}
                        className={`px-3 py-1.5 rounded-lg border text-sm select-none transition-colors ${
                          on ? "bg-emerald-600 border-emerald-600 text-white cursor-pointer"
                          : blocked ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                          : "bg-white border-stone-300 text-stone-700 hover:bg-emerald-50 cursor-pointer"}`}>
                        <input type="checkbox" className="sr-only" checked={on} disabled={blocked} onChange={() => toggle(key)} />
                        {subject}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-rose-700 font-medium">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-stone-200">
          <button onClick={close} className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50">취소</button>
          <button onClick={submit} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">추가</button>
        </div>
      </div>
    </div>
  );
}
