import * as XLSX from "xlsx";

export interface AccountRow {
  name: string;
  loginId: string;
}

// A열=이름, B열=아이디. 1행은 머리글로 간주해 건너뜀. 빈 행은 무시.
export function parseAccountsWorkbook(buffer: ArrayBuffer): AccountRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const values: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const rows: AccountRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const name = (row?.[0] ?? "").toString().trim();
    const loginId = (row?.[1] ?? "").toString().trim();
    if (!name && !loginId) continue;
    rows.push({ name, loginId });
  }
  return rows;
}
