"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Loader2, Lock, CheckCircle2, AlertTriangle } from "lucide-react";

interface SessionData {
  schoolName: string;
  trainingTitles: string[];
  isGroup: boolean;
  locked: boolean;
  teachers: { name: string; signed: boolean }[];
  totalCount: number;
  signedCount: number;
}

type Step = "loading" | "error" | "locked" | "name" | "sign" | "done";

function SignKiosk() {
  const searchParams = useSearchParams();
  const sid = searchParams.get("session") ?? "";

  const [step, setStep] = useState<Step>(() => (sid ? "loading" : "error"));
  const [data, setData] = useState<SessionData | null>(null);
  const [errorMessage, setErrorMessage] = useState(() => (sid ? "" : "잘못된 접속입니다."));
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDataUrl, setPendingDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!sid) return;
    fetch(`/api/schedule-helper/certificates/sessions/${sid}`)
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) {
          setErrorMessage(body.error ?? "오류가 발생했습니다.");
          setStep("error");
          return;
        }
        setData(body);
        setStep(body.locked ? "locked" : "name");
      })
      .catch(() => {
        setErrorMessage("서버 연결에 실패했습니다.");
        setStep("error");
      });
  }, [sid]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap?.clientWidth || 320;
    const h = Math.round(w * 0.55);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#F8F9FB";
    ctx.fillRect(0, 0, w, h);
    setDrawn(false);
  };

  const pick = (name: string) => {
    setSelectedName(name);
    setStep("sign");
    setTimeout(initCanvas, 0);
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const handleClear = () => initCanvas();

  const handleRequestConfirm = () => {
    if (!drawn || !canvasRef.current) return;
    setPendingDataUrl(canvasRef.current.toDataURL("image/png"));
    setSubmitError("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (!pendingDataUrl) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const base64 = pendingDataUrl.split(",")[1];
      const res = await fetch(`/api/schedule-helper/certificates/sessions/${sid}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherName: selectedName, signaturePng: base64 }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body.error ?? "오류가 발생했습니다.");
        return;
      }
      setConfirmOpen(false);
      setStep("done");
    } catch {
      setSubmitError("서버 연결에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeachers = (data?.teachers ?? []).filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[#07111F] text-[#E8EDF5] font-sans flex flex-col">
      <div className="bg-[#0D2137] border-b-[3px] border-[#F5C842] px-4 pt-3 pb-2.5 shrink-0">
        <div className="text-[11px] text-[#F5C842]/70 tracking-widest uppercase mb-0.5">
          {data?.schoolName ?? ""}
        </div>
        <div className="text-[22px] font-bold text-white mb-1.5">
          {data?.isGroup ? "복수 연수 동시 서명" : (data?.trainingTitles[0] ?? "연수 서명")}
        </div>
        {data?.isGroup && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {data.trainingTitles.map((t) => (
              <span
                key={t}
                className="text-[11px] bg-[#F5C842]/15 text-[#F5C842] border border-[#F5C842]/30 rounded-full px-2.5 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {data && (
          <>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[13px] text-[#F5C842]/60">서명 현황</span>
              <span className="text-[15px] font-bold text-[#F5C842]">
                {data.signedCount} <span className="opacity-70 font-normal text-sm">/ {data.totalCount}명</span>
              </span>
            </div>
            <div className="bg-white/10 rounded h-[7px]">
              <div
                className="bg-[#F5C842] h-full rounded transition-all"
                style={{ width: `${data.totalCount > 0 ? Math.round((data.signedCount / data.totalCount) * 100) : 0}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6 pt-2">
        {step === "loading" && (
          <div className="text-center pt-24">
            <Loader2 className="w-10 h-10 animate-spin text-[#F5C842] mx-auto mb-4" />
            <p className="text-white/30 text-base">명단 불러오는 중...</p>
          </div>
        )}

        {step === "error" && (
          <div className="text-center pt-16 px-5">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[#F5C842]" />
            <div className="text-2xl font-bold text-white mb-3">오류가 발생했습니다</div>
            <div className="text-white/50 text-base leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {step === "locked" && (
          <div className="text-center pt-16">
            <Lock className="w-16 h-16 mx-auto mb-4 text-[#F5C842]" />
            <div className="text-2xl font-bold text-[#F5C842] mb-3">서명이 마감되었습니다</div>
            <div className="text-white/50 text-base leading-relaxed">관리자에게 문의해주세요.</div>
          </div>
        )}

        {step === "name" && (
          <div className="bg-[#0F1E33] border border-[#F5C842]/20 rounded-2xl p-3.5">
            <div className="text-[13px] text-[#F5C842]/60 tracking-wider uppercase mb-3">
              선생님 성함을 선택하세요
            </div>
            <div className="relative mb-2.5">
              <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 검색..."
                className="w-full py-3.5 pl-11 pr-3 bg-white/[0.07] text-[#E8EDF5] border border-[#F5C842]/20 rounded-xl text-lg outline-none focus:border-[#F5C842]"
              />
            </div>
            <div className="flex flex-col gap-2">
              {filteredTeachers.length === 0 ? (
                <div className="py-8 text-center text-white/25 text-[17px]">명단이 비어있습니다.</div>
              ) : (
                filteredTeachers.map((t) => (
                  <button
                    key={t.name}
                    disabled={t.signed}
                    onClick={() => pick(t.name)}
                    className={`flex items-center justify-between px-4 py-4.5 rounded-xl text-lg font-bold border transition-all text-left ${
                      t.signed
                        ? "opacity-35 pointer-events-none bg-white/[0.06] border-white/[0.08] text-[#D8E2EF]"
                        : "bg-white/[0.06] border-white/[0.08] text-[#D8E2EF] hover:bg-[#F5C842]/10 hover:border-[#F5C842]/50 hover:text-[#F5C842] active:scale-[0.98]"
                    }`}
                  >
                    <span>{t.name}</span>
                    {t.signed ? (
                      <span className="text-[13px] bg-[#F5C842]/12 text-[#F5C842] px-3 py-1 rounded-full border border-[#F5C842]/30">
                        완료
                      </span>
                    ) : (
                      <span className="text-[22px] text-[#F5C842]/40">›</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === "sign" && (
          <div className="bg-[#0F1E33] border border-[#F5C842]/20 rounded-2xl p-3.5">
            <div className="text-[28px] font-bold text-[#F5C842] text-center mb-1">{selectedName} 선생님</div>
            <div className="text-[15px] text-white/35 text-center mb-3">흰 영역에 손가락으로 서명해 주세요</div>
            <div className="w-[calc(100%+20px)] -ml-2.5 border-[2.5px] border-[#F5C842]/50 rounded-[10px] bg-[#F8F9FB] overflow-hidden touch-none select-none">
              <canvas
                ref={canvasRef}
                className="block w-full"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
            <div className="flex gap-2.5 mt-3.5">
              <button
                onClick={handleClear}
                className="flex-1 py-4.5 bg-transparent text-[#F5C842]/70 border-2 border-[#F5C842]/30 rounded-xl text-[17px] font-bold"
              >
                ↺ 다시 쓰기
              </button>
              <button
                onClick={handleRequestConfirm}
                disabled={!drawn}
                className="flex-[2] py-4.5 bg-[#F5C842] text-[#07111F] rounded-xl text-xl font-bold disabled:opacity-30"
              >
                서명 제출 →
              </button>
            </div>
            <button
              onClick={() => {
                setStep("name");
                setSelectedName("");
                setQuery("");
              }}
              className="block w-full text-center mt-3.5 bg-transparent border-none text-white/30 text-base py-2"
            >
              ← 이름 다시 선택
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center pt-16">
            <CheckCircle2 className="w-[70px] h-[70px] mx-auto mb-4 text-[#F5C842]" />
            <div className="text-2xl font-bold text-[#F5C842] mb-3">{selectedName} 선생님</div>
            <div className="text-white/50 text-base leading-loose">
              서명이 완료되었습니다!
              <br />
              감사합니다 😊
            </div>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <div
            className="bg-[#0F1E33] border border-[#F5C842]/30 rounded-[22px] p-7 w-full max-w-[360px] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[44px] mb-2.5">✍️</div>
            <div className="text-xl font-bold text-[#F5C842] mb-1.5">{selectedName} 선생님</div>
            <div className="text-[15px] text-white/45 mb-4.5 leading-relaxed">
              이 서명으로 최종 제출할까요?
              <br />
              제출 후에는 수정이 불가합니다.
            </div>
            <div className="rounded-[10px] overflow-hidden mb-4.5 bg-white border border-[#F5C842]/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingDataUrl} alt="서명" className="w-full block" />
            </div>
            {submitError && <p className="text-rose-400 text-sm mb-3">{submitError}</p>}
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="flex-1 py-4 rounded-xl border border-white/10 bg-transparent text-white/45 text-[17px] font-bold"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] py-4 rounded-xl border-none bg-[#F5C842] text-[#07111F] text-[19px] font-bold disabled:opacity-45 inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                제출하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#07111F] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#F5C842]" />
        </div>
      }
    >
      <SignKiosk />
    </Suspense>
  );
}
