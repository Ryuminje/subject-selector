import * as XLSX from "xlsx";

export interface ScheduleRow {
  teacher: string;
  [key: string]: string; // e.g., "월1": "2학년 수학(3-5)", "화2": "A(2-2)"
}

// 관리자가 업로드한 엑셀에서 뽑아내는 시간표 원본. 교체 불가/협의회 불가/교과군 설정은
// 더 이상 엑셀("설정" 시트)에서 오지 않고 Teacher 레코드에서 관리합니다 (교사 목록 관리 화면 참고).
export interface ScheduleData {
  teachers: string[];
  days: string[];
  periods: number[];
  tableData: ScheduleRow[];
}

// "아이디(이름)" 형태에서 이름만 안전하게 추출
function extractName(fullName: string): string {
  if (!fullName) return "";
  const str = fullName.toString();
  const match = str.match(/\(([^)]+)\)/);
  if (match) return match[1].trim();
  return str.trim();
}

export function parseScheduleWorkbook(buffer: ArrayBuffer): ScheduleData {
  const workbook = XLSX.read(buffer, { type: "array" });

  // 시트 이름으로 데이터 찾기
  const scheduleSheetName = workbook.SheetNames.find((n) => n === "시트1") || workbook.SheetNames[0];
  const scheduleSheet = workbook.Sheets[scheduleSheetName];
  const values: string[][] = XLSX.utils.sheet_to_json(scheduleSheet, { header: 1, defval: "" });

  if (values.length < 5) throw new Error("데이터가 너무 적습니다. 시트1에 데이터를 확인해주세요.");

  const headerDays = values[2];
  const headerPeriods = values[3];

  let lastCol = 2;
  for (let j = 2; j < headerPeriods.length; j++) {
    if (headerPeriods[j] && !isNaN(parseInt(headerPeriods[j]))) {
      lastCol = j + 1;
    }
  }

  let maxPeriodInHeader = 0;
  for (let j = 2; j < lastCol; j++) {
    const pVal = parseInt(headerPeriods[j]);
    if (!isNaN(pVal) && pVal > maxPeriodInHeader) maxPeriodInHeader = pVal;
  }

  const teacherList: string[] = [];
  const tableData: ScheduleRow[] = [];
  const actualMaxPeriods: Record<string, number> = {};
  const validDays = ["월", "화", "수", "목", "금"];

  for (let i = 4; i < values.length; i++) {
    const rawName = values[i][1];
    if (!rawName || rawName.toString().trim() === "" || rawName.toString().includes("교사성명")) continue;

    const cleanName = extractName(rawName);
    teacherList.push(cleanName);
    const rowObj: ScheduleRow = { teacher: cleanName };

    let currentDay = "";
    for (let j = 2; j < lastCol; j++) {
      if (headerDays[j] && headerDays[j].toString().trim() !== "") currentDay = headerDays[j].toString().trim();
      if (currentDay === "토" || currentDay === "일") continue;
      if (!validDays.includes(currentDay)) continue;

      const periodVal = headerPeriods[j] ? headerPeriods[j].toString().trim() : "";
      if (currentDay && periodVal && !isNaN(parseInt(periodVal))) {
        const cellValue = values[i][j] ? values[i][j].toString().trim() : "";
        rowObj[currentDay + periodVal] = cellValue;
        if (cellValue !== "") {
          const periodNum = parseInt(periodVal);
          if (!actualMaxPeriods[currentDay] || periodNum > actualMaxPeriods[currentDay]) {
            actualMaxPeriods[currentDay] = periodNum;
          }
        }
      }
    }
    tableData.push(rowObj);
  }

  let actualMaxPeriod = 0;
  for (const day of validDays) {
    if (actualMaxPeriods[day] && actualMaxPeriods[day] > actualMaxPeriod) actualMaxPeriod = actualMaxPeriods[day];
  }
  if (actualMaxPeriod === 0) actualMaxPeriod = maxPeriodInHeader;

  const periods = Array.from({ length: actualMaxPeriod }, (_, i) => i + 1);

  return {
    teachers: Array.from(new Set(teacherList)).sort(),
    days: validDays,
    periods,
    tableData,
  };
}
