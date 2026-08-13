"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { koreanDate } from "@/features/schedule-helper/lib/makeup/buildRows";
import { MAKEUP_DOC_KEY, type MakeupDoc } from "@/features/schedule-helper/lib/makeup/types";

// 보강원 인쇄 페이지 (A4 1장).
//
// ⚠️ 문서 모양은 **이 파일에만** 있습니다. 학교 한글(.hwp) 서식을 받으면 아래 <article> 안의
// 표와 머리말만 그 모양대로 바꾸면 되고, 담기·날짜 계산·데이터 전달은 손댈 필요가 없습니다.
// 한글 파일 자체를 채워 내보내는 건 자바스크립트로 불가능해서(AI 파트너가 hwp 업로드를
// 막아둔 것과 같은 이유), 같은 모양을 화면으로 재현해 인쇄·PDF로 뽑는 방식입니다.
//
// 문서는 서버에 저장하지 않기로 한 기능이라 sessionStorage로 넘겨받습니다.

export default function MakeupPrintPage() {
  const [doc, setDoc] = useState<MakeupDoc | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const raw = sessionStorage.getItem(MAKEUP_DOC_KEY);
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
  useEffect(() => {
    if (!doc) return;
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
        @page { size: A4 portrait; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff; }
        }
      `}</style>

      <div className="no-print max-w-[210mm] mx-auto mb-4 flex justify-end px-4">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" /> 다시 인쇄
        </button>
      </div>

      <article className="max-w-[210mm] mx-auto bg-white p-[15mm] print:p-0 shadow-sm print:shadow-none text-slate-900">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="pt-2">
              <p className="text-sm text-slate-600">{doc.schoolName}</p>
            </div>
            {/* 결재란 — 서식에 맞춰 칸 이름을 바꾸면 됩니다. */}
            <table className="border-collapse text-[11px] text-center">
              <tbody>
                <tr>
                  <td rowSpan={2} className="border border-slate-400 px-2 py-1 w-7 align-middle leading-tight">
                    결<br />재
                  </td>
                  {["담당", "부장", "교감", "교장"].map((label) => (
                    <td key={label} className="border border-slate-400 px-3 py-1 w-16 bg-slate-50">
                      {label}
                    </td>
                  ))}
                </tr>
                <tr>
                  {["담당", "부장", "교감", "교장"].map((label) => (
                    <td key={label} className="border border-slate-400 h-12" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h1 className="text-center text-2xl font-bold tracking-[0.4em] mt-4 mb-6">수업교체·보강원</h1>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <th className="border border-slate-400 bg-slate-50 py-1.5 w-24 font-semibold">신청인</th>
                <td className="border border-slate-400 py-1.5 px-3">{doc.writerTeacher}</td>
                <th className="border border-slate-400 bg-slate-50 py-1.5 w-24 font-semibold">결강 사유</th>
                <td className="border border-slate-400 py-1.5 px-3">{doc.reason}</td>
              </tr>
            </tbody>
          </table>
        </header>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["번호", "일자", "요일", "교시", "학급", "과목", "구분", "결강 교사", "대체 교사"].map((h) => (
                <th key={h} className="border border-slate-400 bg-slate-100 py-1.5 px-1 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((row, i) => (
              <tr key={`${row.date}-${row.period}-${row.toTeacher}-${i}`}>
                <td className="border border-slate-400 text-center py-1.5">{i + 1}</td>
                <td className="border border-slate-400 text-center py-1.5 whitespace-nowrap">{row.date}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.weekday}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.period}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.className}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.subject}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.kindLabel}</td>
                <td className="border border-slate-400 text-center py-1.5">{row.fromTeacher}</td>
                <td className="border border-slate-400 text-center py-1.5 font-semibold">{row.toTeacher}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-sm mt-10">위와 같이 수업 교체 및 보강을 신청합니다.</p>

        <div className="text-center mt-8 text-sm">
          <p>{koreanDate(doc.createdAt.slice(0, 10))}</p>
          <p className="mt-4">
            신청인 : <span className="font-semibold">{doc.writerTeacher}</span>
            <span className="ml-2 text-slate-400">(서명)</span>
          </p>
        </div>

        <p className="text-center text-base font-bold tracking-[0.3em] mt-12">{doc.schoolName}장 귀하</p>
      </article>
    </div>
  );
}
