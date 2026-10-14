"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, NotebookPen } from "lucide-react";
import type { Note, Notes } from "../lib/saveFile";

interface Props {
  /** 학생 키(`번호|이름`). 비어 있으면 아무것도 그리지 않습니다. */
  pkey: string;
  name: string;
  notes: Notes;
  onChange: (pkey: string, note: Note) => void;
}

/** 어느 탭에서나 쓰는 상담 메모. 접어 두었다가 펼쳐 쓰고, 인쇄에는 내용이 있을 때만 나옵니다. */
export function NotesPanel({ pkey, name, notes, onChange }: Props) {
  const [open, setOpen] = useState(false);
  if (!pkey) return null;
  const note = notes[pkey] ?? { career: "", memo: "" };
  const filled = !!(note.career || note.memo);
  return (
    <>
      <section className="print:hidden rounded-2xl border border-stone-200 bg-white p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left text-sm font-bold"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <NotebookPen className="w-4 h-4 text-amber-700" />
          상담 메모 · {name}
          {filled && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">작성됨</span>}
        </button>
        {open && (
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
            <label className="block text-xs font-medium text-stone-700">
              진로 희망
              <input
                value={note.career}
                onChange={(e) => onChange(pkey, { ...note, career: e.target.value })}
                placeholder="예) 간호사, 소프트웨어 개발자"
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              담임 관찰 메모
              <textarea
                value={note.memo}
                onChange={(e) => onChange(pkey, { ...note, memo: e.target.value })}
                rows={3}
                placeholder="수업 태도, 학습 습관, 유의 사항 등"
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-normal"
              />
            </label>
            <p className="md:col-span-2 text-xs text-stone-500">
              메모는 이 화면에만 있고 서버로 가지 않습니다. 위쪽 &lsquo;저장하기&rsquo;로 파일에 담아 두세요.
            </p>
          </div>
        )}
      </section>
      {filled && (
        <section className="hidden print:block rounded-2xl border border-stone-300 p-4">
          <h2 className="font-bold mb-1">상담 메모</h2>
          {note.career && <p className="text-sm">진로 희망: {note.career}</p>}
          {note.memo && <p className="text-sm whitespace-pre-wrap mt-1">{note.memo}</p>}
        </section>
      )}
    </>
  );
}
