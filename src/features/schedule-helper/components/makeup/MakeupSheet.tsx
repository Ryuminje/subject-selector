"use client";

import { parseDate } from "@/features/schedule-helper/lib/makeup/buildRows";
import {
  MAKEUP_REASONS,
  type MakeupDoc,
  type MakeupRow,
  type MakeupSheet as MakeupSheetData,
} from "@/features/schedule-helper/lib/makeup/types";

// 보강원 한 장 — 학교에서 받은 "수업 교체 및 동과 보강 계획서" 서식을 그대로 재현합니다.
//
// ⚠️ **문서 모양은 이 파일에만 있습니다.** 서식이 바뀌면 여기만 고치면 되고, 담기·날짜 계산·
// 데이터 전달(인쇄 페이지)은 손댈 필요가 없습니다. 한글 파일 자체를 채워 내보내는 건
// 자바스크립트로 불가능해서(AI 파트너가 hwp 업로드를 막아둔 것과 같은 이유), 같은 모양을
// 화면으로 그려 인쇄·PDF로 뽑는 방식입니다.
//
// 칸 너비는 원본 PDF에서 글자 좌표를 재서 맞춘 비율입니다(본문 폭 472pt 기준).
// 서식과 나란히 놓고 비교했을 때 어긋나면 이 숫자부터 보세요.
const COLUMNS = [
  { label: "교과명", width: "15.3%" },
  { label: "학 반", width: "12.7%" },
  { label: "교 시", width: "10.6%" },
  { label: "교체대상 교시", width: "19.1%" },
  { label: "교체대상 교과", width: "19.1%" },
  { label: "교사명", width: "23.2%" },
];

/** 서식은 표가 3줄로 인쇄돼 있습니다. 건수가 적어도 빈 줄을 남겨 같은 모양을 유지합니다. */
const MIN_ROWS = 3;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function MakeupSheet({ doc, sheet }: { doc: MakeupDoc; sheet: MakeupSheetData }) {
  const date = parseDate(sheet.date);
  const blanks = Math.max(0, MIN_ROWS - sheet.rows.length);

  return (
    // 화면에서도 인쇄와 같은 폭으로 보이도록 좌우 22mm(본문 166mm)를 맞춥니다.
    // 인쇄할 때는 @page 여백이 대신하므로 print:p-0으로 뺍니다.
    <article className="sheet max-w-[210mm] mx-auto mb-8 print:mb-0 bg-white px-[22mm] py-[12mm] print:p-0 shadow-sm print:shadow-none text-black">
      <h1 className="text-center text-[22px] font-bold mb-9">수업 교체 및 동과 보강 계획서</h1>

      <div className="space-y-2.5 text-[15px] mb-5">
        <p>
          교 사 : <span className="inline-block min-w-[7rem] font-semibold">{doc.writerTeacher}</span>
          <span className="ml-1">(인)</span>
        </p>
        <p>
          일 시 : {date ? date.getFullYear() : ""}. {date ? date.getMonth() + 1 : ""} .{" "}
          {date ? date.getDate() : ""} .( {date ? WEEKDAYS[date.getDay()] : ""} )
        </p>
        <p>
          사 유 :{" "}
          {MAKEUP_REASONS.map((reason, i) => (
            <span key={reason}>
              {i > 0 && ", "}
              {/* 손으로 동그라미 치는 자리입니다. 고른 항목을 미리 표시해 둡니다. */}
              <span
                className={
                  reason === doc.reason
                    ? "inline-block rounded-full border border-black px-1.5 font-semibold"
                    : undefined
                }
              >
                {reason}
              </span>
            </span>
          ))}
          ( <span className="font-semibold">{doc.reason === "기타" ? doc.reasonDetail ?? "" : ""}</span> )
        </p>
      </div>

      <table className="w-full border-collapse text-[14px] table-fixed">
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.label} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.slice(0, 3).map((col) => (
              <th key={col.label} rowSpan={2} className="border border-black py-1.5 font-normal align-middle">
                {col.label}
              </th>
            ))}
            <th colSpan={2} className="border border-black py-1.5 font-normal">
              수업 교체의 경우만 기재
            </th>
            <th rowSpan={2} className="border border-black py-1.5 font-normal align-middle leading-tight">
              교체 및 동과보강
              <br />
              교사명
            </th>
          </tr>
          <tr>
            <th className="border border-black py-1.5 font-normal">교체대상 교시</th>
            <th className="border border-black py-1.5 font-normal">교체대상 교과</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, i) => (
            <Row key={`${row.period}-${row.partnerTeacher}-${i}`} row={row} />
          ))}
          {/* 서식의 3줄 모양을 지키기 위한 빈 줄 */}
          {Array.from({ length: blanks }, (_, i) => (
            <Row key={`blank-${i}`} />
          ))}
        </tbody>
      </table>

      <p className="text-center text-[15px] mt-12">위와 같이 수업을 처리합니다.</p>

      <div className="flex justify-center mt-8">
        <table className="border-collapse text-[13px] text-center">
          <tbody>
            <tr>
              <td rowSpan={2} className="border border-black w-8 align-middle leading-tight py-1">
                결
                <br />재
              </td>
              <td className="border border-black w-28 py-1">일과계</td>
              <td className="border border-black w-28 py-1">부장</td>
            </tr>
            <tr>
              <td className="border border-black h-16" />
              <td className="border border-black h-16" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-14 text-[13px] leading-relaxed">
        <p>
          <span className="mr-2">&lt;작성 요령&gt;</span>하루에 한 장씩 기재해 주십시오.
        </p>
        <p className="pl-[4.6rem]">교체 혹은 동과 보강시 해당 교사의 확인을 직접 받아 주십시오.</p>
      </div>
    </article>
  );
}

/** 표의 한 줄. `row`가 없으면 서식 모양을 채우는 빈 줄입니다. */
function Row({ row }: { row?: MakeupRow }) {
  const cell = "border border-black text-center h-[3.2rem] px-1";
  if (!row) {
    return (
      <tr>
        {COLUMNS.map((col) => (
          <td key={col.label} className={cell} />
        ))}
      </tr>
    );
  }

  const exchangeDate = row.exchangeDate ? parseDate(row.exchangeDate) : null;

  return (
    <tr>
      <td className={cell}>{row.subject}</td>
      <td className={cell}>{row.className}</td>
      <td className={cell}>{row.period}</td>
      {/* "수업 교체의 경우만 기재" — 보강은 두 칸을 비웁니다. */}
      <td className={`${cell} leading-snug whitespace-nowrap`}>
        {exchangeDate && (
          <>
            ( {exchangeDate.getMonth() + 1} )월( {exchangeDate.getDate()} )일
            <br />( {row.exchangePeriod} )교시
          </>
        )}
      </td>
      <td className={cell}>{row.exchangeSubject ?? ""}</td>
      <td className={cell}>
        <span className="font-semibold">{row.partnerTeacher}</span>
        <span className="ml-3">(인)</span>
      </td>
    </tr>
  );
}
