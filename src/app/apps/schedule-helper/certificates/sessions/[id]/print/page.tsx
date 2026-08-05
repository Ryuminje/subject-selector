"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  useEffect(() => {
    fetch(`/api/schedule-helper/certificates/sessions/${sessionId}/print?title=${titleIndex}`)
      .then((res) => res.json())
      .then((body) => setData(body))
      .catch(() => {});
  }, [sessionId, titleIndex]);

  // 고정 시간(예전 400ms) 뒤에 무조건 인쇄하면, 그때까지 그려지지 않은 서명이 빈 칸으로 출력됩니다.
  // 서명은 이제 data URI라 네트워크를 타지 않지만, 디코딩까지 실제로 끝난 것을 확인한 뒤 인쇄합니다.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    const startPrint = () => {
      if (!cancelled) window.print();
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

  if (!data) return <div className="p-10 text-center text-slate-400">불러오는 중...</div>;

  const half = Math.ceil(data.teachers.length / 2);
  const left = data.teachers.slice(0, half);
  const right = data.teachers.slice(half);

  const renderTable = (rows: { name: string; signature: string | null }[], startIdx: number) => (
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
      </tbody>
    </table>
  );

  return (
    <div className="max-w-4xl mx-auto p-8 print:p-0">
      {/*
        브라우저는 기본적으로 배경색을 인쇄하지 않습니다. 표 머리글이 남색 배경 + 흰 글씨라
        그대로 두면 인쇄물에서 흰 바탕에 흰 글씨가 되어 "번호/성명/서명"이 보이지 않습니다.
        print-color-adjust: exact로 머리글 배경을 인쇄물에도 그대로 남깁니다.
      */}
      <style>{`
        @media print {
          thead th {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr { break-inside: avoid; }
        }
      `}</style>
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
        {renderTable(left, 0)}
        {renderTable(right, half)}
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
