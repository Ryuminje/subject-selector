"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Lock, Printer, Unlock, X } from "lucide-react";

interface SessionInfo {
  trainingTitles: string[];
  locked: boolean;
  totalCount: number;
  signedCount: number;
}

// QR 서명 세션의 압축형 표시 — 예전엔 "QR 코드·서명 현황 열기" 버튼을 눌러야 별도 페이지로
// 넘어가야만 QR·서명마감·인쇄를 볼 수 있었습니다. 여기서는 QR을 작게 바로 띄우고(클릭하면
// 크게 팝업), 서명마감·인쇄는 팝업 밖 이 카드에 항상 보이게 뒀습니다.
// (전체 페이지 버전은 SessionProgressPanel.tsx — "이전 연수 세션" 목록에서 지난 세션을 열 때는
// 계속 그 페이지를 씁니다. 여기는 지금 선택된 연수 하나를 카드 안에서 바로 보여주는 용도입니다.)
export default function SignSessionMini({ sessionId, trainingTitle }: { sessionId: string; trainingTitle: string }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const signUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/apps/schedule-helper/certificates/sign?session=${sessionId}`
      : "";

  // 이 화면을 켜둔 채 옆에서 서명이 들어오는 걸 실시간으로 보고 싶어하는 용도라 5초 폴링합니다
  // (SessionProgressPanel.tsx와 같은 간격). setState는 항상 .then() 안에서만 호출합니다.
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`/api/schedule-helper/certificates/sessions/${sessionId}`)
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (cancelled || !ok) return;
          setInfo(body);
        })
        .catch(() => {});
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

  const qrImgUrl = (size: number) =>
    signUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(signUrl)}&format=png`
      : "";

  // 복수 연수 세션이면 인쇄 링크가 연수마다 따로 필요합니다(등록부 명단이 연수별로 갈리므로).
  // 폴링이 아직 안 끝났으면 이 카드가 대표하는 연수 하나만 우선 보여줍니다.
  const titles = info?.trainingTitles ?? [trainingTitle];

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => setShowQr(true)}
        className="shrink-0 border border-slate-200 rounded-xl p-1 bg-white hover:border-teal-300 transition-colors"
        title="QR 코드 크게 보기"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImgUrl(72)}
          alt="QR 코드"
          className="w-16 h-16"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </button>

      <div className="flex-1 min-w-0 space-y-2">
        {info ? (
          <div className="flex items-center gap-2 text-xs">
            {info.locked ? (
              <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                <Lock className="w-3.5 h-3.5" /> 마감됨
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 수집 중
              </span>
            )}
            <span className="text-slate-400 tabular-nums">
              {info.signedCount} / {info.totalCount}명
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-400">불러오는 중...</div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={!info || toggling}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-60 ${
              info?.locked
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
            }`}
          >
            {info?.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {info?.locked ? "서명 재개" : "서명 마감"}
          </button>

          {titles.map((t, idx) => (
            <a
              key={t}
              href={`/apps/schedule-helper/certificates/sessions/${sessionId}/print?title=${idx}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold text-slate-600 bg-white border border-slate-200 hover:border-teal-300 hover:text-teal-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> {titles.length > 1 ? `${t} 인쇄` : "등록부 인쇄"}
            </a>
          ))}
        </div>
      </div>

      {showQr && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative bg-white rounded-3xl shadow-xl w-full max-w-xs p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImgUrl(280)}
              alt="QR 코드"
              className="w-[280px] h-[280px] border border-slate-200 rounded-xl mx-auto mb-3 bg-slate-50"
            />
            <p className="text-xs text-slate-500 mb-2">스마트폰으로 QR 코드를 스캔하세요</p>
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5 max-w-full">
              <span className="text-xs text-teal-800 font-mono break-all">{signUrl}</span>
              <button onClick={handleCopy} className="shrink-0 text-teal-700 hover:text-teal-900">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
