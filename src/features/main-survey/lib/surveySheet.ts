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
 * 업로드한 원본 엑셀에서 전출 학생 행을 빼고 전입 학생 행을 끼워 넣은 통합문서를 만든다.
 * 칸을 통째로 옮겨 서식(글꼴·테두리·병합·열 너비)을 그대로 유지하고, 전입 행은 이웃 학생 행의 서식을 따른다.
 * 실패하면 이유(문자열)를 돌려준다.
 * @param rawRows 앱이 들고 있는 현재 학생 행(추가·삭제가 반영된 상태)
 */
export function buildEditedSurveyWorkbook(dataUrl: string, rawRows: Record<string, unknown>[]): XLSX.WorkBook | string {
  const wb = XLSX.read(dataUrl.slice(dataUrl.indexOf(",") + 1), { type: "base64", cellStyles: true });
  const wsName = pickSurveySheetName(wb);
  const ws = wb.Sheets[wsName];
  // range: 0 — 행 번호를 시트 절대 행 번호와 맞춰 아래에서 같은 좌표로 칸을 옮긴다.
  const sheetData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, range: 0 });
  const layout = findSurveyLayout(sheetData);
  if (!layout) return "원본 파일에서 학번·이름 열을 찾을 수 없습니다.";
  const { headers, startDataRowIndex, seqCol } = layout;

  const idCol = headers.findIndex(h => h.includes("학번"));
  const nameCol = headers.findIndex(h => h.includes("이름") || h.includes("성명"));
  const idAt = (r: number) => String(sheetData[r]?.[idCol] ?? "").trim();
  const idOfRaw = (r: Record<string, unknown>) => {
    const k = Object.keys(r).find(k => k.includes("학번"));
    return k ? String(r[k]).trim() : "";
  };
  const keepIds = new Set(rawRows.map(idOfRaw));

  // 출력 행 = 원본 행 번호(src) 또는 전입 행(src: null, 서식 견본 tmpl)
  type OutRow = { src: number | null; tmpl: number; id: string };
  const isStudent = (r: number) => /^\d{4,}/.test(idAt(r));
  const students: OutRow[] = [];
  const tail: number[] = [];
  for (let r = startDataRowIndex; r < sheetData.length; r++) {
    if (!sheetData[r] || sheetData[r].length === 0) continue;
    if (isStudent(r)) { if (keepIds.has(idAt(r))) students.push({ src: r, tmpl: r, id: idAt(r) }); }
    else tail.push(r);
  }
  const firstStudentRow = students[0]?.tmpl ?? startDataRowIndex;

  const added = new Map<string, Record<string, unknown>>();
  const existing = new Set(students.map(s => s.id));
  rawRows.filter(r => r.__manual).forEach(r => {
    const id = idOfRaw(r);
    if (existing.has(id)) return;
    existing.add(id);
    added.set(id, r);
    // 학번 순서 위치에 끼워 넣고, 서식은 바로 앞(없으면 첫) 학생 행을 따른다
    const at = students.findIndex(s => Number(s.id) > Number(id));
    const pos = at === -1 ? students.length : at;
    const tmpl = students[pos - 1]?.tmpl ?? students[pos]?.tmpl ?? firstStudentRow;
    students.splice(pos, 0, { src: null, tmpl, id });
  });

  const next: XLSX.WorkSheet = {};
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const lastCol = Math.max(range.e.c, headers.length - 1);
  const copyRow = (from: number, to: number) => {
    for (let c = 0; c <= lastCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: from, c })];
      if (cell) next[XLSX.utils.encode_cell({ r: to, c })] = { ...cell };
    }
  };
  const put = (r: number, c: number, v: string | number, tmpl: number) => {
    const style = ws[XLSX.utils.encode_cell({ r: tmpl, c })]?.s;
    next[XLSX.utils.encode_cell({ r, c })] = { t: typeof v === "number" ? "n" : "s", v, ...(style ? { s: style } : {}) };
  };

  for (let r = 0; r < startDataRowIndex; r++) copyRow(r, r);

  const idHeaderRow = sheetData.find(h => h?.some(c => String(c ?? "").includes("학번"))) ?? [];
  let out = startDataRowIndex;
  students.forEach((s, i) => {
    if (s.src !== null) {
      copyRow(s.src, out);
    } else {
      // 서식만 견본 행에서 가져오고 값은 새로 채운다
      for (let c = 0; c <= lastCol; c++) {
        const style = ws[XLSX.utils.encode_cell({ r: s.tmpl, c })]?.s;
        if (style) next[XLSX.utils.encode_cell({ r: out, c })] = { t: "s", v: "", s: style };
      }
      const row = added.get(s.id)!;
      // 학번 칸이 원본에서 숫자였으면 숫자로, 문자였으면 문자로 맞춘다
      put(out, idCol, ws[XLSX.utils.encode_cell({ r: s.tmpl, c: idCol })]?.t === "n" ? Number(s.id) : s.id, s.tmpl);
      const nameKey = Object.keys(row).find(k => k.includes("이름") || k.includes("성명"));
      put(out, nameCol, String(nameKey ? row[nameKey] : ""), s.tmpl);
      // 학년·반 열은 학번에서 채운다 (5자리 20101 → 2학년 1반, 4자리 2101 → 2학년 1반)
      const cls = s.id.length >= 5 ? Number(s.id.substring(1, 3)) : Number(s.id.substring(1, 2));
      idHeaderRow.forEach((h, c) => {
        const t = String(h ?? "").trim();
        if (t === "학년") put(out, c, Number(s.id[0]), s.tmpl);
        else if (t === "반") put(out, c, cls, s.tmpl);
      });
      // 앱 안에서는 "O"로 들고 있지만 리로스쿨 원본 서식의 선택 표시는 숫자 1이다
      headers.forEach((h, c) => { if (h.includes("::") && row[h] === "O") put(out, c, 1, s.tmpl); });
    }
    if (seqCol >= 0) put(out, seqCol, i + 1, s.tmpl);
    out++;
  });
  tail.forEach(r => { copyRow(r, out); out++; });

  next["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(out - 1, 0), c: lastCol } });
  if (ws["!cols"]) next["!cols"] = ws["!cols"];
  if (ws["!merges"]) next["!merges"] = ws["!merges"].filter(m => m.e.r < startDataRowIndex);
  wb.Sheets[wsName] = next;
  return wb;
}

/** 수정본을 파일로 내려받는다. 성공하면 null, 실패하면 이유를 돌려준다. */
export function downloadEditedSurveyWorkbook(dataUrl: string, rawRows: Record<string, unknown>[], fileName: string): string | null {
  const wb = buildEditedSurveyWorkbook(dataUrl, rawRows);
  if (typeof wb === "string") return wb;
  XLSX.writeFile(wb, fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "_수정본.xlsx");
  return null;
}

/** 수정본을 data URL로 돌려준다(리로스쿨용 내보내기가 원본 대신 이걸 다시 열어 쓴다). 실패하면 null. */
export function editedSurveyDataUrl(dataUrl: string, rawRows: Record<string, unknown>[]): string | null {
  const wb = buildEditedSurveyWorkbook(dataUrl, rawRows);
  if (typeof wb === "string") return null;
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx", cellStyles: true });
  return "data:application/octet-stream;base64," + b64;
}
