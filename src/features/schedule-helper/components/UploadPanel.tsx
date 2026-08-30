"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";

export default function UploadPanel({ compact = false }: { compact?: boolean }) {
  const { refetch } = useSchedule();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/schedule-helper/upload", {
      method: "POST",
      body: formData,
    });
    const body = await res.json().catch(() => ({}));
    setUploading(false);

    if (!res.ok) {
      setMessage({ type: "error", text: body.error ?? "업로드에 실패했습니다." });
      return;
    }

    setMessage({ type: "success", text: `교사 ${body.teacherCount}명 시간표를 반영했습니다.` });
    setFile(null);
    await refetch();
  };

  return (
    <div className={compact ? "" : "bg-white rounded-[14px] border border-stone-200 p-6"}>
      {!compact && (
        <h2 className="font-display text-lg text-swap mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          시간표 엑셀 업로드
        </h2>
      )}
      <p className="text-sm text-stone-500 mb-4">
        학기별 전체 교사 시간표 엑셀 파일(.xlsx)을 업로드하면 전체 교사·시간표 데이터가 갱신됩니다.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-sm text-stone-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-swap/10 file:text-swap file:font-semibold hover:file:bg-swap/15 file:cursor-pointer cursor-pointer"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-5 py-2.5 bg-swap hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-[10px] transition-opacity flex items-center justify-center gap-2 shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          업로드
        </button>
      </div>

      {message && (
        <div
          className={`mt-3 text-sm px-3 py-2 rounded-[10px] border ${
            message.type === "success"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-rose-600 bg-rose-50 border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
