"use client";

import { use, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// A4 세로, 아래 <style>의 @page margin과 반드시 맞춰야 높이 계산이 맞습니다.
const PX_PER_MM = 96 / 25.4;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;

interface PrintData {
  schoolName: string;
  trainingTitle: string;
  createdAt: string;
  /** signature는 서버가 함께 내려주는 data URI (별도 이미지 요청 없음) */
  teachers: { name: string; signature: string | null }[];
}

function PrintContent({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const titleIndex = searchParams.get("title") ?? "0";
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/schedule-helper/certificates/sessions/${sessionId}/print?title=${titleIndex}`)
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      // ⚠️ 이 인쇄 API는 관리자 전용인데(print/route.ts), 정작 이 화면으로 오는 세션 상세 페이지는
      // 로그인 없이도 누구나 열 수 있게 일부러 열어둔 화면입니다(QR 서명용, sessions/[id]/route.ts 주석 참고).
      // 그래서 비로그인·비관리자가 인쇄를 누르면 서버가 { error: "..." }를 401/403으로 돌려주는데,
      // res.ok를 안 보고 그대로 setData하면 data.teachers가 없어 화면이 그대로 죽었습니다(실제로 겪은 버그).
      .then(({ ok, body }) => {
        if (ok) setData(body);
        else setError(body.error ?? "인쇄 정보를 불러오지 못했습니다.");
      })
      .catch(() => setError("서버 연결에 실패했습니다."));
  }, [sessionId, titleIndex]);

  // 명단이 길면 인쇄가 페이지 높이를 넘겨 2장 이상으로 나뉩니다. "무조건 1장" 요구를 지키기 위해
  // 인쇄 직전에 실제 렌더된 높이를 재서, 한 페이지에 안 들어가면 전체를 균등하게 축소합니다
  // (가로세로 같은 비율로 줄어들어 글자가 찌그러지지 않음 — scaleY만 쓰면 글자가 눌려 보입니다).
  // outerRef에 축소 후 높이를 그대로 못 박아 둬야 브라우저가 "줄어들기 전" 높이로 페이지를
  // 나누는 걸 막을 수 있습니다(transform은 레이아웃 흐름에서의 크기를 바꾸지 않기 때문).
  //
  // ⚠️ 좌우 정렬: 처음엔 transformOrigin을 "top left"로 두고 줄어든 너비만큼 왼쪽 여백을 JS로
  // 계산해 더했는데, 이 계산이 "인쇄 시점의 실제 폭"과 조금씩 어긋나 완전히 가운데로 오지
  // 않았습니다(실제로 겪음 — 화면에서 계산한 상수와 인쇄 결과가 정확히 안 맞았습니다).
  // "top center"를 쓰면 브라우저가 인쇄 시점의 실제 렌더 폭을 기준으로 스스로 중심을 잡아서
  // 폭을 따로 계산할 필요가 없고, 어떤 상황에서도 어긋나지 않습니다 — 세로만 위쪽 기준으로
  // 줄어들고(높이 계산은 그대로 유효), 가로는 좌우 대칭으로 줄어듭니다.
  const fitToOnePage = () => {
    const outer = outerRef.current;
    const inner = printRef.current;
    if (!outer || !inner) return;
    inner.style.transform = "";
    outer.style.height = "";
    const usableHeightPx = (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2) * PX_PER_MM;
    const contentHeightPx = inner.scrollHeight;
    if (contentHeightPx <= usableHeightPx) return;

    const scale = usableHeightPx / contentHeightPx;
    inner.style.transformOrigin = "top center";
    inner.style.transform = `scale(${scale})`;
    outer.style.height = `${usableHeightPx}px`;
    outer.style.overflow = "hidden";
  };

  // 고정 시간(예전 400ms) 뒤에 무조건 인쇄하면, 그때까지 그려지지 않은 서명이 빈 칸으로 출력됩니다.
  // 서명은 이제 data URI라 네트워크를 타지 않지만, 디코딩까지 실제로 끝난 것을 확인한 뒤 인쇄합니다.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    const startPrint = () => {
      if (cancelled) return;
      fitToOnePage();
      window.print();
    };

    const imgs = Array.from(document.querySelectorAll("img"));
    const decoded = imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            // 한 장이 깨져도 나머지는 정상 출력되도록 실패도 완료로 처리합니다.
            img.addEventListener("error", () => resolve(), { once: true });
          })
    );

    // 어떤 이유로든 이미지가 끝나지 않아도 인쇄가 영영 안 열리는 일은 없도록 상한을 둡니다.
    const safety = new Promise<void>((resolve) => setTimeout(resolve, 5000));

    Promise.race([Promise.all(decoded).then(() => undefined), safety]).then(startPrint);

    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) return <div className="p-10 text-center text-rose-600">{error}</div>;
  if (!data) return <div className="p-10 text-center text-slate-400">불러오는 중...</div>;

  const half = Math.ceil(data.teachers.length / 2);
  const left = data.teachers.slice(0, half);
  const right = data.teachers.slice(half);

  // 오른쪽 칸이 왼쪽보다 짧을 때(홀수 인원) 빈 줄을 채워 두 표의 행 개수를 맞춥니다.
  // RosterTable.tsx의 같은 처리와 동일한 규칙 — padTo에 half를 넘기면 왼쪽 표에서는 항상 0입니다.
  const renderTable = (rows: { name: string; signature: string | null }[], startIdx: number, padTo: number) => {
    const padCount = Math.max(0, padTo - rows.length);
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5 w-10">번호</th>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5">성명</th>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5">서명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.name}>
              <td className="border border-slate-300 text-center py-2 text-slate-500">{startIdx + i + 1}</td>
              <td className="border border-slate-300 text-center py-2 font-bold">{t.name}</td>
              <td className="border border-slate-300 text-center py-2">
                {t.signature ? (
                  // 서버가 data URI로 함께 내려준 서명 — 인쇄 시 다시 가져올 것이 없습니다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.signature} alt="서명" className="h-10 mx-auto" />
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`}>
              <td className="border border-slate-300 py-2">&nbsp;</td>
              <td className="border border-slate-300 py-2">&nbsp;</td>
              <td className="border border-slate-300 py-2">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div ref={outerRef}>
      {/*
        브라우저는 기본적으로 배경색을 인쇄하지 않습니다. 표 머리글이 남색 배경 + 흰 글씨라
        그대로 두면 인쇄물에서 흰 바탕에 흰 글씨가 되어 "번호/성명/서명"이 보이지 않습니다.
        print-color-adjust: exact로 머리글 배경을 인쇄물에도 그대로 남깁니다.

        @page margin은 위 PAGE_MARGIN_MM 상수와 반드시 같은 값이어야 fitToOnePage의 축소 계산이
        맞습니다. 브라우저가 자체로 붙이는 "머리글과 바닥글"(URL·제목·날짜·페이지 번호)은 인쇄
        대화상자의 설정이라 이 페이지에서 켜고 끌 수 없습니다 — 마지막으로 쓴 값을 기억해 두는
        브라우저 설정이니 한 번 꺼두면 다음에도 꺼진 채로 남습니다.
      */}
      <style>{`
        @page {
          size: A4;
          margin: ${PAGE_MARGIN_MM}mm;
        }
        @media print {
          thead th {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr { break-inside: avoid; }
        }
      `}</style>
      <div ref={printRef} className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="text-center text-xl font-bold border-b-2 border-slate-800 pb-2 mb-3">연수 교직원 등록부</div>
        <div className="flex justify-between text-sm mb-1">
          <span>
            <b>연수명</b> {data.trainingTitle}
          </span>
          <span>{new Date(data.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span>
            <b>소속</b> {data.schoolName}
          </span>
          <span>
            <b>총원</b> {data.teachers.length}명
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {renderTable(left, 0, half)}
          {renderTable(right, half, half)}
        </div>
      </div>
    </div>
  );
}

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">불러오는 중...</div>}>
      <PrintContent sessionId={id} />
    </Suspense>
  );
}
