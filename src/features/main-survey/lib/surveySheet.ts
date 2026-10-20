import * as XLSX from "xlsx-js-style";

/** 본조사 설문 엑셀에서 과목 매트릭스가 시작하는 열(0-based). H열부터. */
const SUBJECT_MATRIX_START_COL = 7;

export interface SurveyLayout {
  /** 열 번호 → 파싱 키("학번", "이름", "그룹::과목"). 쓰지 않는 열은 "" */
  headers: string[];
  startDataRowIndex: number;
  /** "순번" 열 번호(없으면 -1) */
  seqCol: number;
}

/** 업로드 파일에서 데이터를 읽을 시트 이름 — 시트가 여러 개면 두 번째 시트 */
export function pickSurveySheetName(wb: XLSX.WorkBook): string {
  return wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0];
}

/** 헤더 행을 찾아 열별 파싱 키를 만든다. 학번·이름 열이 없으면 null. */
export function findSurveyLayout(sheetData: unknown[][]): SurveyLayout | null {
  let headerRowIndex = -1;
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (Array.isArray(row)) {
      const hasId = row.some(cell => String(cell || "").includes("학번"));
      const hasName = row.some(cell => String(cell || "").includes("이름") || String(cell || "").includes("성명"));
      if (hasId && hasName) { headerRowIndex = i; break; }
    }
  }
  if (headerRowIndex === -1) return null;

  const row1 = sheetData[headerRowIndex];
  const row2 = sheetData[headerRowIndex + 1];
  const tempHeaders = row1.map(h => String(h || "").trim());
  const idColIndex = tempHeaders.findIndex(h => h.includes("학번"));
  const nameColIndex = tempHeaders.findIndex(h => h.includes("이름") || h.includes("성명"));

  const hasMultiRowHeader = row2 &&
    !row2[idColIndex] &&
    !row2[nameColIndex] &&
    row2.some(cell => typeof cell === "string" && String(cell).trim().length > 0);

  const blocklist = ["순번", "학년", "학번", "이름", "성명", "성별", "과정", "메모", "과목수", "합계", "총계"];
  const maxLength = Math.max(row1.length, row2 ? row2.length : 0);

  const parentHeaders: string[] = [];
  let lastParentHeader = "";
  for (let c = 0; c < maxLength; c++) {
    const val = String(row1[c] || "").trim();
    if (val) lastParentHeader = val;
    parentHeaders.push(lastParentHeader);
  }

  const headers: string[] = [];
  for (let c = 0; c < maxLength; c++) {
    const val1 = String(row1[c] || "").trim();
    const val2 = row2 ? String(row2[c] || "").trim() : "";
    const parentHeader = parentHeaders[c] || "";
    if (c < SUBJECT_MATRIX_START_COL && c !== idColIndex && c !== nameColIndex) { headers.push(""); continue; }
    if (hasMultiRowHeader) {
      if (blocklist.some(b => val1.includes(b))) headers.push(val1);
      else if (parentHeader.includes("지정")) headers.push("");
      else headers.push(val2 ? `${parentHeader}::${val2}` : val1);
    } else {
      headers.push(val1.includes("지정") ? "" : val1);
    }
  }

  return {
    headers,
    startDataRowIndex: hasMultiRowHeader ? headerRowIndex + 2 : headerRowIndex + 1,
    seqCol: tempHeaders.findIndex(h => h.includes("순번")),
  };
}

/**
 * 업로드한 원본 엑셀에서 전출 학생 행을 빼고 전입 학생 행을 끼워 넣은 수정본을 내려받는다.
 * 원본 서식(머리글 병합·열 너비)은 유지하고, 학생 행은 값만 옮긴다.
 * 성공하면 null, 실패하면 이유를 돌려준다.
 * @param rawRows 앱이 들고 있는 현재 학생 행(추가·삭제가 반영된 상태)
 */
export function downloadEditedSurveyWorkbook(dataUrl: string, rawRows: Record<string, unknown>[], fileName: string): string | null {
  const wb = XLSX.read(dataUrl.split(",")[1], { type: "base64" });
  const wsName = pickSurveySheetName(wb);
  const ws = wb.Sheets[wsName];
  const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const layout = findSurveyLayout(sheetData);
  if (!layout) return "원본 파일에서 학번·이름 열을 찾을 수 없습니다.";
  const { headers, startDataRowIndex, seqCol } = layout;

  const idCol = headers.findIndex(h => h.includes("학번"));
  const nameCol = headers.findIndex(h => h.includes("이름") || h.includes("성명"));
  const idOf = (r: unknown[]) => String(r?.[idCol] ?? "").trim();
  const keepIds = new Set(rawRows.map(r => {
    const k = Object.keys(r).find(k => k.includes("학번"));
    return k ? String(r[k]).trim() : "";
  }));

  const head = sheetData.slice(0, startDataRowIndex);
  const body = sheetData.slice(startDataRowIndex);
  // 학생 행만 걸러낸다. 학번이 숫자가 아닌 행(합계 등)은 건드리지 않고 맨 뒤에 둔다.
  const isStudent = (r: unknown[]) => /^\d{4,}/.test(idOf(r));
  const students = body.filter(r => isStudent(r) && keepIds.has(idOf(r)));
  const tail = body.filter(r => !isStudent(r) && r && r.length > 0);

  const existing = new Set(students.map(idOf));
  const width = headers.length;
  rawRows.filter(r => r.__manual).forEach(r => {
    const idKey = Object.keys(r).find(k => k.includes("학번"))!;
    const id = String(r[idKey]).trim();
    if (existing.has(id)) return;
    const row: unknown[] = new Array(width).fill("");
    row[idCol] = id;
    // 학년·반 열은 학번에서 채운다 (5자리 20101 → 2학년 1반, 4자리 2101 → 2학년 1반)
    const grade = Number(id[0]);
    const cls = id.length >= 5 ? Number(id.substring(1, 3)) : Number(id.substring(1, 2));
    (head.find(h => h.some(c => String(c ?? "").includes("학번"))) ?? []).forEach((c, i) => {
      const t = String(c ?? "").trim();
      if (t === "학년") row[i] = grade;
      else if (t === "반") row[i] = cls;
    });
    const nameKey = Object.keys(r).find(k => k.includes("이름") || k.includes("성명"));
    row[nameCol] = nameKey ? r[nameKey] : "";
    headers.forEach((h, c) => { if (h.includes("::") && r[h] === "O") row[c] = "O"; });
    // 학번 순서 위치에 끼워 넣는다
    const at = students.findIndex(s => Number(idOf(s)) > Number(id));
    if (at === -1) students.push(row); else students.splice(at, 0, row);
  });

  if (seqCol >= 0) students.forEach((r, i) => { r[seqCol] = i + 1; });

  const next = XLSX.utils.aoa_to_sheet([...head, ...students, ...tail]);
  if (ws["!cols"]) next["!cols"] = ws["!cols"];
  if (ws["!merges"]) next["!merges"] = ws["!merges"].filter(m => m.e.r < startDataRowIndex);
  wb.Sheets[wsName] = next;

  XLSX.writeFile(wb, fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "_수정본.xlsx");
  return null;
}
