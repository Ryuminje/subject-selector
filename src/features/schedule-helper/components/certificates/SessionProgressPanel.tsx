"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock, Printer, Copy, Check, Loader2 } from "lucide-react";

interface SessionInfo {
  schoolName: string;
  trainingTitles: string[];
  isGroup: boolean;
  locked: boolean;
  totalCount: number;
  signedCount: number;
}

export default function SessionProgressPanel({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const signUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/apps/schedule-helper/certificates/sign?session=${sessionId}`
      : "";

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`/api/schedule-helper/certificates/sessions/${sessionId}`)
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (cancelled) return;
          if (!ok) {
            setError(body.error ?? "오류가 발생했습니다.");
            return;
          }
          setInfo(body);
        })
        .catch(() => {
          if (!cancelled) setError("서버 연결에 실패했습니다.");
        });
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  const handleToggleLock = async () => {
    if (!info) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/schedule-helper/certificates/sessions/${sessionId}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !info.locked }),
      });
      const body = await res.json();
      if (res.ok) setInfo({ ...info, locked: body.locked });
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(signUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!info) {
    return (
      <div className="flex justify-center py-12 text-teal-600">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const qrImgUrl = signUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(signUrl)}&format=png`
    : "";
  const percent = info.totalCount > 0 ? Math.round((info.signedCount / info.totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="text-center mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImgUrl}
            alt="QR 코드"
            className="w-[200px] h-[200px] border border-slate-200 rounded-xl mx-auto mb-2 bg-slate-50"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <p className="text-xs text-slate-500 mb-2">스마트폰으로 QR 코드를 스캔하세요</p>
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5">
            <span className="text-xs text-teal-800 font-mono break-all">{signUrl}</span>
            <button onClick={handleCopy} className="shrink-0 text-teal-700 hover:text-teal-900">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {info.trainingTitles.map((t) => (
              <span key={t} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-slate-700">서명 현황</span>
            <span className="text-base font-bold text-teal-700">
              {info.signedCount} / {info.totalCount}명
            </span>
          </div>
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="bg-teal-600 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <button
          onClick={handleToggleLock}
          disabled={toggling}
          className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors disabled:opacity-60 ${
            info.locked ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-500 hover:bg-rose-400 text-white"
          }`}
        >
          {info.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {info.locked ? "서명 재개" : "서명 마감"}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <Printer className="w-5 h-5" /> 인쇄
        </h2>
        <div className="space-y-2">
          {info.trainingTitles.map((t, idx) => (
            <a
              key={t}
              href={`/apps/schedule-helper/certificates/sessions/${sessionId}/print?title=${idx}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-left px-4 py-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors text-sm font-semibold text-slate-700"
            >
              {t} 등록부 인쇄
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
