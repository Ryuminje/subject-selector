"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import {
  ENVELOPE_LABEL_KEY,
  type EnvelopeLabel,
  type EnvelopeLayout,
} from "@/features/exam-scheduler/lib/io/openEnvelopeLabels";

// 시험지 봉투 겉면에 붙일 표지. 한 봉투에 한 장이라 A5 가로로 한 장씩 끊어 나갑니다.
// 내용은 봉투 표지 `.xls`와 같은 데이터(buildEnvelopeRows)입니다.

/** 글자 폭 합계(em). 한글·한자는 한 칸, 영문·숫자·기호는 반 칸으로 봅니다. */
function emWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += ch.charCodeAt(0) < 0x2e80 ? 0.5 : 1;
  return width;
}

/**
 * 한 줄이 주어진 폭 안에 들어가도록 글씨 크기를 정합니다.
 *
 * 실제로 재서 맞추는 게 정확하지만 인쇄 미리보기에서는 측정 시점이 어긋나 값이 튑니다.
 * 표지는 줄이 셋뿐이고 들어올 내용도 뻔해서(과목명·학반·타임) 폭 추정으로 충분합니다.
 * ponytail: 폭 추정 근사(굵은 글씨 여유 5%). 넘치는 경우가 보이면 그때 실측으로 바꾸세요.
 */
function fitMm(text: string, base: number, min: number, boxMm: number): number {
  const width = emWidth(text);
  if (width === 0) return base;
  return Math.max(min, Math.min(base, (boxMm * 0.95) / width));
}

/** 표지 안쪽 폭(mm) — A5 가로 210 − 바깥 여백 14 − 테두리 안쪽 여백 24. */
const INNER_MM = 172;
/** 타임/반 줄은 24mm 들여쓰므로 그만큼 좁습니다. */
const SUB_INNER_MM = INNER_MM - 24;

function Label({ row }: { row: EnvelopeLabel }) {
  // 두 줄은 크기가 같아야 서식대로 보입니다 — 둘 중 더 긴 쪽에 맞춰 함께 줄입니다.
  const mainMm = Math.min(
    fitMm(`과목명 : ${row.subject}`, 13, 7, INNER_MM),
    fitMm(`학년-반: ${row.examRoom}`, 13, 7, INNER_MM),
  );
  // 타임/반은 본문보다 커 보이면 안 됩니다.
  const subMm = Math.min(fitMm(row.timeClass, 11, 5, SUB_INNER_MM), mainMm * 0.85);

  return (
    <div className="label">
      <div className="label-box">
        <p className="line" style={{ fontSize: `${mainMm}mm` }}>
          과목명 : {row.subject}
        </p>
        <p className="line mt" style={{ fontSize: `${mainMm}mm` }}>
          학년-반: {row.examRoom}
        </p>
        {/* 타임/반은 값이 없을 수도 있습니다(학반이 곧 강의실인 일반 과목). */}
        {row.timeClass && (
          <p className="line sub" style={{ fontSize: `${subMm}mm` }}>
            {row.timeClass}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EnvelopeLabelPrintPage() {
  const [rows, setRows] = useState<EnvelopeLabel[] | null>(null);
  const [layout, setLayout] = useState<EnvelopeLayout>("a5");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      // 용지 배치는 주소로 받습니다(useSearchParams는 Suspense가 필요해 과합니다).
      if (new URLSearchParams(window.location.search).get("layout") === "a4-2up") {
        setLayout("a4-2up");
      }

      // 새 탭에는 localStorage로만 확실히 전달됩니다. 받자마자 옮겨 담아, 이 탭에서
      // 새로고침은 되면서도 브라우저에 오래 남지 않게 합니다.
      const handoff = localStorage.getItem(ENVELOPE_LABEL_KEY);
      if (handoff) {
        localStorage.removeItem(ENVELOPE_LABEL_KEY);
        sessionStorage.setItem(ENVELOPE_LABEL_KEY, handoff);
      }

      const raw = handoff ?? sessionStorage.getItem(ENVELOPE_LABEL_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as EnvelopeLabel[];
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
        setRows(parsed);
      } catch {
        setMissing(true);
      }
    });
  }, []);

  // ⚠️ 브라우저 자동화로 열면 인쇄 대화상자가 렌더러를 막아 페이지 읽기가 타임아웃됩니다.
  // 내용만 확인할 때는 주소에 ?noprint=1 을 붙이세요.
  useEffect(() => {
    if (!rows) return;
    if (new URLSearchParams(window.location.search).has("noprint")) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [rows]);

  if (missing) {
    return (
      <div className="p-10 text-center text-slate-500">
        <p className="mb-1 font-semibold">시험지 봉투 표지 데이터가 없습니다.</p>
        <p className="text-sm">
          시험 시간표 작성 도우미의 결과·출력 단계에서 &quot;시험지 봉투 표지 인쇄 (A5)&quot;를 다시 눌러주세요.
        </p>
      </div>
    );
  }

  if (!rows) return <div className="p-10 text-center text-slate-400">불러오는 중...</div>;

  // 한 장에 몇 개를 얹을지. 쪽 넘김은 표지가 아니라 "장"에 걸어야 2장씩 배치가 어긋나지
  // 않습니다(표지에 nth-child로 걸면 머리말 같은 형제가 하나만 끼어도 홀짝이 밀립니다).
  const perSheet = layout === "a4-2up" ? 2 : 1;
  const sheets: EnvelopeLabel[][] = [];
  for (let i = 0; i < rows.length; i += perSheet) sheets.push(rows.slice(i, i + perSheet));

  return (
    <div className={`envelope-print layout-${layout} bg-slate-100 py-8 print:bg-white print:py-0`}>
      {/* @page는 선택자를 못 받아 배치별로 규칙 자체를 갈아 끼웁니다. */}
      <style>{
        layout === "a4-2up"
          ? "@page { size: A4 portrait; margin: 0; }"
          : "@page { size: A5 landscape; margin: 0; }"
      }</style>
      <style>{`
        /* A5 한 장 = 210×148mm. 그 세로 둘이 297mm라 A4 세로에 정확히 들어갑니다. */
        .envelope-print.layout-a5 { --label-h: 148mm; --pad: 7mm; }
        .envelope-print.layout-a4-2up { --label-h: 148.5mm; --pad: 3mm; }

        .envelope-print .sheet {
          width: 210mm;
          margin: 0 auto 8mm;
          background: #fff;
        }
        .envelope-print .label {
          width: 210mm;
          height: var(--label-h);
          background: #fff;
          padding: var(--pad);
          box-sizing: border-box;
        }
        .envelope-print .label-box {
          width: 100%;
          height: 100%;
          border: 0.6mm solid #000;
          padding: 10mm 12mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }
        .envelope-print .line {
          color: #000;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }
        /* 과목명과 학년-반 사이는 한 줄 비웁니다(원래 서식 그대로). */
        .envelope-print .line.mt { margin-top: 14mm; }
        /* 타임/반은 학년-반 값 아래에 들여씁니다. */
        .envelope-print .line.sub { margin-top: 3mm; padding-left: 24mm; font-weight: 500; }

        @media print {
          html, body { background: #fff; }
          .no-print { display: none !important; }
          .envelope-print .sheet {
            margin: 0;
            break-after: page;
          }
          .envelope-print .sheet:last-child { break-after: auto; }
          /* 한 장 안의 표지는 절대 갈라지면 안 됩니다. */
          .envelope-print .label { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-4 px-4">
        <p className="text-sm text-slate-500">
          시험지 봉투 표지 {rows.length}장 ·{" "}
          {layout === "a4-2up"
            ? `A4 세로 ${sheets.length}쪽 (한 쪽에 2장)`
            : `A5 가로 ${sheets.length}쪽 (한 쪽에 1장)`}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          <Printer className="h-4 w-4" /> 인쇄
        </button>
      </div>

      {sheets.map((sheet, sheetIndex) => (
        <div className="sheet" key={sheetIndex}>
          {sheet.map((row, index) => (
            <Label key={`${row.examDate}|${row.period}|${row.subject}|${row.examRoom}|${index}`} row={row} />
          ))}
        </div>
      ))}
    </div>
  );
}
