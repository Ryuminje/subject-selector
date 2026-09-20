"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";

/** 끌어다 놓거나 눌러서 고르는 파일 올리기 칸. 파일은 브라우저 메모리로만 읽습니다. */
export function FileDrop({
  accept,
  multiple = false,
  onFiles,
  title,
  hint,
  compact = false,
}: {
  /** input accept 와 같은 형식. 확장자(.pdf)만 드롭 필터로 씁니다. */
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const exts = accept.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.startsWith("."));

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter(
      (f) => exts.length === 0 || exts.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-1.5 text-center rounded-[14px] border-2 border-dashed cursor-pointer transition-colors ${
        compact ? "px-4 py-4" : "px-6 py-12"
      } ${over ? "border-pdf bg-pdf/5" : "border-stone-300 bg-white/70 hover:border-pdf/50 hover:bg-pdf/5"}`}
    >
      <Upload className="w-6 h-6 text-pdf" />
      <p className="font-medium text-stone-800">{title}</p>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
