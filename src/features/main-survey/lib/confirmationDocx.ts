import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
  type ITableCellOptions,
} from "docx";
import type { GradeKey, ProcessedStudent, SelectedSubjectHours, SubjectMap } from "../../../types";

// 수강신청(본조사) 4단계 → 학생별 "선택과목 수강신청 확인서" .docx 생성.
//
// 학생 한 명이 문서의 섹션 하나이고(섹션은 새 페이지에서 시작), **반드시 한 장**에 들어가야 합니다.
// 표에는 학생이 신청한 선택과목만 넣습니다(학교 지정 과목은 사용자 요청으로 뺐음).
//
// 페이지 구성: 위(본문)에는 제목·학생 정보·선택과목 표, **아래(섹션 바닥글)에는 확인 사항·확인 문구·
// 날짜·서명란**. 바닥글은 Word가 페이지 맨 아래에 붙이므로 과목이 3개든 23개든 아랫부분 위치가
// 모든 학생에게 똑같습니다(사용자 요청: "제일 아래쪽으로 가서 모든 학생이 통일성이 있도록").
// 인쇄 화면이 아니라 파일로 주는 이유는 담임이 문구를 손보거나 학교 양식에 맞춰 편집한 뒤
// 출력하는 경우가 많아서 — 그래서 표를 이미지가 아니라 진짜 Word 표로 만듭니다.

/** 4단계 탭은 "현재" 학년인데 확인서는 "다음 학년도" 기준으로 찍습니다(엑셀 다운로드 버튼과 같은 규칙). */
export const CONFIRMATION_GRADE_LABEL: Record<GradeKey, string> = {
  pre1: "1학년",
  grade1: "2학년",
  grade2: "3학년",
};
const CONFIRMATION_GRADE_NUMBER: Record<GradeKey, number> = { pre1: 1, grade1: 2, grade2: 3 };

export interface ConfirmationDocxInput {
  schoolName: string;
  grade: GradeKey;
  /** 예: 2026 → "2026학년도" */
  schoolYear: number;
  /** YYYY-MM-DD (input[type=date] 값) */
  signDate: string;
  students: ProcessedStudent[];
  /** 1단계 편성표의 선택과목별 교과군·학기별 학점 — 없으면 학점 칸이 비어 나갑니다 */
  selectedSubjectHours: SelectedSubjectHours[];
  subjectMap: SubjectMap;
}

// ---------- 문구 ----------

/** 받침 유무로 조사를 고릅니다. 한글이 아닌 글자(로마숫자 Ⅱ 등)로 끝나면 받침 없음으로 봅니다. */
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const trimmed = word.trim();
  const last = trimmed.charCodeAt(trimmed.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasBatchim = isHangul && (last - 0xac00) % 28 !== 0;
  return `${trimmed}${hasBatchim ? withBatchim : withoutBatchim}`;
}

/**
 * "확인 사항" 칸에 들어갈 문구. 4단계 화면의 경고 4종을 사용자가 정한 문장으로 바꿉니다.
 * 학년별로 다른 것은 영역 미이수(원인 4)뿐입니다 — 1·2학년은 "졸업까지"가 붙고 3학년은 안 붙습니다.
 * 실제로는 한 학생에게 한두 개가 보통입니다(사용자 확인). 네 가지가 동시에 나오는 극단 케이스는
 * 바닥글이 그만큼 위로 자라 표 영역이 줄어드는 것으로 감당합니다.
 */
export function buildNotices(student: ProcessedStudent, grade: GradeKey): string[] {
  const notes: string[] = [];

  // 원인 1 — 기초(국·수·영) 과다. 4단계 화면의 "기초과목 최대학점 초과"(basicCount >= 10)와 같은 조건.
  if (student.basicCount >= 10) {
    notes.push("기초 교과(국·수·영)는 필수과목을 제외하고 선택과목에서 9개 까지만 이수할 수 있습니다. 담임과 상의해 조정하세요.");
  }

  // 원인 2 — 같은 과목을 두 번 이상 신청.
  for (const subject of student.duplicateSubjects ?? []) {
    notes.push(`${subject} 과목이 중복 신청되었습니다. 한 학기만 남기고 정정하세요.`);
  }

  // 원인 3 — 선수과목 없이 심화과목 신청. v.subject가 심화, v.prereq가 선수.
  for (const v of student.hierarchyViolations ?? []) {
    notes.push(`필수는 아니지만 ${josa(v.prereq, "을", "를")} 듣고 ${josa(v.subject, "을", "를")} 듣는 것을 권장합니다.`);
  }

  // 원인 4 — 사회/과학 영역에서 아무것도 안 고름. 3학년(grade2 탭)만 문구가 다릅니다.
  for (const category of student.missingCategories ?? []) {
    notes.push(
      grade === "grade2"
        ? `${category} 교과(군)에서 최소 1과목을 선택해야 합니다.`
        : `졸업까지 ${category} 교과(군)에서 최소 1과목은 선택하여 이수해야 합니다.`
    );
  }

  return notes.length > 0 ? notes : ["특이사항 없음"];
}

// ---------- 표 데이터 ----------

interface SubjectRow {
  category: string;
  subject: string;
  sem1: number | null;
  sem2: number | null;
}

/** 4단계 화면과 같은 규칙으로 과목명을 비교합니다(공백 제거, 로마숫자 통일). */
const normS = (s: string) => (s ? s.replace(/\s+/g, "").replace(/Ⅰ/g, "I").replace(/Ⅱ/g, "II").replace(/Ⅲ/g, "III") : "");

/**
 * 학생이 고른 선택과목만, 1학기 → 연간 → 2학기 순으로.
 * 학점은 편성표의 학기별 운영학점에서 가져오되 학생이 1학기만 골랐으면 1학기 칸에만 찍고,
 * 편성표에 없는 과목(수동 입력 등)은 학점 칸을 비워 둡니다 — 없는 숫자를 지어내지 않습니다.
 */
function buildSubjectRows(student: ProcessedStudent, input: ConfirmationDocxInput): SubjectRow[] {
  const rows: SubjectRow[] = [];
  const findHours = (subject: string) => input.selectedSubjectHours.find((h) => normS(h.subject) === normS(subject));

  for (const subject of student.semester1) {
    const h = findHours(subject);
    rows.push({ category: h?.detailedCategory ?? "", subject, sem1: h ? h.sem1 || h.sem2 || null : null, sem2: null });
  }
  for (const subject of student.semester1_2 ?? []) {
    const h = findHours(subject);
    rows.push({ category: h?.detailedCategory ?? "", subject, sem1: h ? h.sem1 || null : null, sem2: h ? h.sem2 || null : null });
  }
  for (const subject of student.semester2) {
    const h = findHours(subject);
    rows.push({ category: h?.detailedCategory ?? "", subject, sem1: null, sem2: h ? h.sem2 || h.sem1 || null : null });
  }
  return rows;
}

// ---------- 한 장에 넣기 ----------

/**
 * 본문에 남는 높이는 A4(297mm) − 위 여백(14) − 바닥글 몫(아래 여백 82) − 제목·학생 정보 블록(약 45mm)
 * ≈ 155mm. 이 학교의 선택과목은 **많아야 13과목**(사용자 확인)이라, 13과목 + 머리글 + 합계 = 15행이
 * 이 영역을 꽉 채우도록 행 높이를 고정합니다(144mm ÷ 15 ≈ 9.6mm, 넘침 방지용 여유 약 10mm 포함).
 * 과목이 적은 학생도 같은 행 높이를 써서 표 모양이 통일되고, 남는 자리는 표 아래에 비워 둡니다
 * (서명란은 바닥글이라 위치가 변하지 않음). 13개를 넘는 예외 케이스만 행을 나눠 촘촘하게 줄입니다.
 */
const MAX_SUBJECTS = 13;
const TABLE_AREA_MM = 141;
interface RowStyle {
  heightMm: number;
  size: number; // 반포인트 (22 = 11pt)
  margins: { top: number; bottom: number; left: number; right: number };
}
// ⚠️ 셀 위아래 여백은 0으로 둡니다. Word는 `trHeight`(atLeast)에 셀 위아래 여백을 **더해서** 행을 그리기
// 때문에, 여백 60twip씩을 주면 9.6mm로 요청한 행이 실제로는 11.7mm로 찍혔습니다(스크린샷 실측 — 그래서
// 13과목이 두 장으로 넘쳤음). 글자는 세로 가운데 정렬이라 위아래 여백이 없어도 보기엔 같습니다.
function rowStyleFor(rowCount: number): RowStyle {
  if (rowCount <= MAX_SUBJECTS) {
    return { heightMm: TABLE_AREA_MM / (MAX_SUBJECTS + 2), size: 22, margins: { top: 0, bottom: 0, left: 110, right: 110 } };
  }
  const heightMm = Math.max(4.8, TABLE_AREA_MM / (rowCount + 2));
  if (heightMm >= 7) return { heightMm, size: 20, margins: { top: 0, bottom: 0, left: 100, right: 100 } };
  if (heightMm >= 5.6) return { heightMm, size: 18, margins: { top: 0, bottom: 0, left: 90, right: 90 } };
  return { heightMm, size: 16, margins: { top: 0, bottom: 0, left: 80, right: 80 } };
}

// ---------- docx 조립 ----------

const mm = convertMillimetersToTwip;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "333333" } as const;
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGINS = { top: 40, bottom: 40, left: 100, right: 100 };
const HEADER_FILL = "EFEFEF";
const TOTAL_FILL = "F3F3F3";

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

interface TextOpts {
  bold?: boolean;
  size?: number;
  color?: string;
  font?: string;
}

function text(content: string, opts: TextOpts = {}) {
  return new TextRun({ text: content, bold: opts.bold, size: opts.size, color: opts.color, font: opts.font });
}

function para(content: string | TextRun[], opts: TextOpts & { align?: Align; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    // line: 240 = 단일 줄 간격. Word 기본(1.15줄 + 문단 뒤 8pt)을 물려받으면 표 한 행이 요청한 높이보다
    // 2~3mm씩 커져서 13과목이 두 장으로 넘쳤습니다(실제로 겪음). 모든 문단에 명시합니다.
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: 240 },
    children: typeof content === "string" ? [text(content, opts)] : content,
  });
}

/** 표 사이 간격. 빈 문단은 한 줄 높이를 통째로 차지하므로 글자를 아주 작게 해서 간격만 남깁니다. */
function gap(twips: number) {
  return new Paragraph({ spacing: { before: 0, after: twips, line: 40 }, children: [new TextRun({ text: "", size: 2 })] });
}

function cell(
  content: string | Paragraph[],
  opts: TextOpts & { width: number; align?: Align; fill?: string; columnSpan?: number; margins?: RowStyle["margins"] }
) {
  const children =
    typeof content === "string"
      ? [para(content, { align: opts.align ?? AlignmentType.CENTER, bold: opts.bold, size: opts.size, color: opts.color })]
      : content;
  const cellOptions: ITableCellOptions = {
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    margins: opts.margins ?? CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.columnSpan,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    children,
  };
  return new TableCell(cellOptions);
}

function fullWidthTable(rows: TableRow[]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function hoursText(n: number | null) {
  return n === null ? "—" : String(n);
}

function formatKoreanDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "년   월   일";
  return `${y}년 ${m}월 ${d}일`;
}

function studentSection(student: ProcessedStudent, input: ConfirmationDocxInput) {
  const gradeNum = CONFIRMATION_GRADE_NUMBER[input.grade];
  const gradeLabel = CONFIRMATION_GRADE_LABEL[input.grade];
  const rows = buildSubjectRows(student, input);
  const sum1 = rows.reduce((acc, r) => acc + (r.sem1 ?? 0), 0);
  const sum2 = rows.reduce((acc, r) => acc + (r.sem2 ?? 0), 0);
  const notices = buildNotices(student, input.grade);
  const rs = rowStyleFor(rows.length);
  const dense = { size: rs.size, margins: rs.margins };
  const rowHeight = { value: mm(rs.heightMm), rule: "atLeast" as const };

  const infoTable = fullWidthTable([
    new TableRow({
      children: [
        cell("학년", { width: 11, bold: true, fill: HEADER_FILL }),
        cell(String(gradeNum), { width: 12, bold: true, size: 24 }),
        cell("반", { width: 11, bold: true, fill: HEADER_FILL }),
        cell(student.classNum || "", { width: 12, bold: true, size: 24 }),
        cell("번호", { width: 11, bold: true, fill: HEADER_FILL }),
        cell(student.num || "", { width: 12, bold: true, size: 24 }),
        cell("성명", { width: 11, bold: true, fill: HEADER_FILL }),
        cell(
          [para([text(student.name, { bold: true, size: 24 }), text(`  (${student.studentId})`, { size: 18, color: "666666" })], { align: AlignmentType.CENTER })],
          { width: 20 }
        ),
      ],
    }),
  ]);

  const subjectHeader = new TableRow({
    tableHeader: true,
    height: rowHeight,
    children: [
      cell("교과(군)", { ...dense, width: 16, bold: true, fill: HEADER_FILL }),
      cell("과목명", { ...dense, width: 48, bold: true, fill: HEADER_FILL }),
      cell("1학기", { ...dense, width: 12, bold: true, fill: HEADER_FILL }),
      cell("2학기", { ...dense, width: 12, bold: true, fill: HEADER_FILL }),
      cell("계", { ...dense, width: 12, bold: true, fill: HEADER_FILL }),
    ],
  });
  const subjectRows = rows.map((r) => {
    const total = (r.sem1 ?? 0) + (r.sem2 ?? 0);
    return new TableRow({
      cantSplit: true,
      height: rowHeight,
      children: [
        cell(r.category, { ...dense, width: 16 }),
        cell(r.subject, { ...dense, width: 48, align: AlignmentType.LEFT }),
        cell(hoursText(r.sem1), { ...dense, width: 12 }),
        cell(hoursText(r.sem2), { ...dense, width: 12 }),
        cell(r.sem1 === null && r.sem2 === null ? "—" : String(total), { ...dense, width: 12 }),
      ],
    });
  });
  const totalRow = new TableRow({
    cantSplit: true,
    height: rowHeight,
    children: [
      cell("선택과목 학점 합계", { ...dense, width: 64, bold: true, fill: TOTAL_FILL, columnSpan: 2 }),
      cell(String(sum1), { ...dense, width: 12, bold: true, fill: TOTAL_FILL }),
      cell(String(sum2), { ...dense, width: 12, bold: true, fill: TOTAL_FILL }),
      cell(String(sum1 + sum2), { ...dense, width: 12, bold: true, fill: TOTAL_FILL }),
    ],
  });
  const subjectTable = fullWidthTable([subjectHeader, ...subjectRows, totalRow]);

  // ---- 페이지 아래 고정 블록(바닥글) ----
  const noticeTable = fullWidthTable([
    new TableRow({
      children: [
        cell([para("확인 사항", { bold: true, after: 60 }), ...notices.map((n) => para(`• ${n}`, { after: 40 }))], { width: 100 }),
      ],
    }),
  ]);

  const signTable = fullWidthTable([
    new TableRow({
      height: { value: 720, rule: "atLeast" },
      children: [
        cell("학 생", { width: 14, bold: true, fill: HEADER_FILL }),
        cell("(서명)", { width: 19, align: AlignmentType.RIGHT, size: 16, color: "888888" }),
        cell("보호자", { width: 14, bold: true, fill: HEADER_FILL }),
        cell("(서명)", { width: 19, align: AlignmentType.RIGHT, size: 16, color: "888888" }),
        cell("담임교사", { width: 14, bold: true, fill: HEADER_FILL }),
        cell("(확인)", { width: 20, align: AlignmentType.RIGHT, size: 16, color: "888888" }),
      ],
    }),
  ]);

  const bottomBlock = new Footer({
    children: [
      noticeTable,
      gap(140),
      para(`위와 같이 ${input.schoolYear}학년도 선택과목 수강신청을 하였음을 확인하며,`, { align: AlignmentType.CENTER, size: 21, after: 20 }),
      para("신청 내용의 변경은 학교에서 정한 기간과 절차에 따름을 알고 있습니다.", { align: AlignmentType.CENTER, size: 21, after: 140 }),
      para(formatKoreanDate(input.signDate), { align: AlignmentType.CENTER, size: 21, after: 140 }),
      signTable,
      new Paragraph({
        spacing: { before: 160 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 4 } },
        children: [
          text(`${input.schoolName} 교육과정부`, { size: 16, color: "666666" }),
          text(`\t${gradeNum} - ${student.classNum} - ${student.num} ${student.name}`, { size: 16, color: "666666" }),
        ],
      }),
    ],
  });

  return {
    properties: {
      page: {
        size: { width: mm(210), height: mm(297) },
        // 아래 여백 82mm는 바닥글 블록(확인 사항 한두 줄 기준 약 70mm) + 페이지 끝 여백 몫입니다.
        // 확인 사항이 더 길면 Word가 본문 아래 여백을 알아서 더 넓혀 겹치지 않습니다.
        margin: { top: mm(14), bottom: mm(82), left: mm(17), right: mm(17), footer: mm(10) },
      },
    },
    footers: { default: bottomBlock },
    children: [
      para(input.schoolName.split("").join(" "), { align: AlignmentType.CENTER, size: 18, color: "444444", after: 40 }),
      para(`${input.schoolYear}학년도 선택과목 수강신청 확인서`, { align: AlignmentType.CENTER, bold: true, size: 36, font: "바탕", after: 40 }),
      para(`${gradeLabel} · ${input.schoolYear}학년도 1학기~2학기 신청 선택과목 · 본조사 결과 기준`, { align: AlignmentType.CENTER, size: 17, color: "555555", after: 160 }),
      infoTable,
      para(
        [
          text("신청 선택과목", { bold: true, size: 21 }),
          text("   본인이 신청한 선택과목입니다(학교 지정 과목 제외). 숫자는 학기별 운영학점입니다.", { size: 15, color: "555555" }),
        ],
        { before: 160, after: 60 }
      ),
      subjectTable,
    ],
  };
}

export async function buildConfirmationDocx(input: ConfirmationDocxInput): Promise<Blob> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "맑은 고딕", size: 20 },
          // 문단 뒤 간격 0·단일 줄 — 표 행 높이가 문단 기본 간격에 끌려 커지는 것을 막습니다.
          paragraph: { spacing: { before: 0, after: 0, line: 240 } },
        },
      },
    },
    sections: input.students.map((s) => studentSection(s, input)),
  });
  return Packer.toBlob(doc);
}

/** 브라우저에서 Blob을 파일로 내려받습니다. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
