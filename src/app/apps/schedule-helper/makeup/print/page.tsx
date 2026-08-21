"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import MakeupSheet from "@/features/schedule-helper/components/makeup/MakeupSheet";
import { MAKEUP_DOC_KEY, type MakeupDoc } from "@/features/schedule-helper/lib/makeup/types";

// 보강원 인쇄 페이지. 문서 **모양**은 여기가 아니라 `MakeupSheet.tsx`에 있습니다 —
// 이 파일은 데이터를 넘겨받아 장 수만큼 늘어놓고 인쇄창을 여는 일만 합니다.
//
// 문서는 서버에 저장하지 않는 기능이라 sessionStorage로 넘겨받습니다.

export default function MakeupPrintPage() {
  const [doc, setDoc] = useState<MakeupDoc | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      // 트레이는 localStorage로 넘겨줍니다(탭이 달라도 확실히 전달되는 유일한 방법 —
      // 자세한 이유는 MakeupTray의 주석 참고). 받자마자 localStorage에서는 지우고
      // 이 탭의 sessionStorage로 옮겨, 사유 같은 내용이 브라우저에 남지 않으면서도
      // 이 탭에서 새로고침은 되도록 합니다.
      const handoff = localStorage.getItem(MAKEUP_DOC_KEY);
      if (handoff) {
        localStorage.removeItem(MAKEUP_DOC_KEY);
        sessionStorage.setItem(MAKEUP_DOC_KEY, handoff);
      }

      const raw = handoff ?? sessionStorage.getItem(MAKEUP_DOC_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      try {
        setDoc(JSON.parse(raw) as MakeupDoc);
      } catch {
        setMissing(true);
      }
    });
  }, []);

  // 내용이 그려진 다음 프레임에 인쇄창을 엽니다. 이미지가 없어 기다릴 것이 없습니다.
  //
  // ⚠️ 브라우저 자동화로 이 페이지를 열면 인쇄 대화상자가 렌더러를 막아 페이지 읽기가
  // 타임아웃됩니다. 내용만 확인할 때는 주소에 ?noprint=1 을 붙이세요.
  useEffect(() => {
    if (!doc) return;
    if (new URLSearchParams(window.location.search).has("noprint")) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [doc]);

  if (missing) {
    return (
      <div className="p-10 text-center text-slate-500">
        <p className="font-semibold mb-1">보강원 데이터가 없습니다.</p>
        <p className="text-sm">수업교체 도우미에서 &quot;보강원 만들기&quot;를 다시 눌러주세요.</p>
      </div>
    );
  }

  if (!doc) return <div className="p-10 text-center text-slate-400">불러오는 중...</div>;

  return (
    <div className="bg-slate-100 print:bg-white min-h-screen py-8 print:py-0">
      <style>{`
        /* 좌우 22mm면 본문 폭이 166mm — 원본 서식의 표 너비(472pt)와 같습니다. */
        @page { size: A4 portrait; margin: 18mm 22mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff; }
          .sheet { break-after: page; }
          .sheet:last-child { break-after: auto; }
        }
      `}</style>

      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between gap-4 px-4">
        <p className="text-sm text-slate-500">
          {doc.writerTeacher} 선생님 · 총 {doc.sheets.length}장
          {doc.sheets.length > 1 && " (하루에 한 장씩)"}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" /> 인쇄
        </button>
      </div>

      {doc.sheets.map((sheet) => (
        <MakeupSheet key={sheet.date} doc={doc} sheet={sheet} />
      ))}
    </div>
  );
}
