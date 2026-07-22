"use client";

import { use, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface PrintData {
  schoolName: string;
  trainingTitle: string;
  createdAt: string;
  teachers: { name: string; signatureId: string | null }[];
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

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (!data) return <div className="p-10 text-center text-slate-400">불러오는 중...</div>;

  const half = Math.ceil(data.teachers.length / 2);
  const left = data.teachers.slice(0, half);
  const right = data.teachers.slice(half);

  const renderTable = (rows: { name: string; signatureId: string | null }[], startIdx: number) => (
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
              {t.signatureId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/schedule-helper/certificates/signatures/${t.signatureId}/image`}
                  alt="서명"
                  className="h-10 mx-auto"
                />
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
