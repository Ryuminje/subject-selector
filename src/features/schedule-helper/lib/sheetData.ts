import * as XLSX from "xlsx";

// 구글 시트 XLSX 내보내기 URL
const SHEET_EXPORT_URL = "https://docs.google.com/spreadsheets/d/12Rz3N-cTyRhNqxSwFVXX__UD9a19E4E-sb5t2ffCX9Q/export?format=xlsx";

export interface ScheduleRow {
  teacher: string;
  [key: string]: string; // e.g., "월1": "2학년 수학(3-5)", "화2": "A(2-2)"
}

export interface ScheduleData {
  teachers: string[];
  days: string[];
  periods: number[];
  tableData: ScheduleRow[];
  defaultBlockSettings: Record<string, Record<string, number[]>>;
  globalMeetingBlocks: Record<string, number[]>;
  teacherDepts: Record<string, string>;
}

// "아이디(이름)" 형태에서 이름만 안전하게 추출
function extractName(fullName: string): string {
  if (!fullName) return "";
  const str = fullName.toString();
  const match = str.match(/\(([^)]+)\)/);
  if (match) return match[1].trim();
  return str.trim();
}

export async function fetchScheduleData(): Promise<ScheduleData> {
  try {
    // 1. 전체 스프레드시트를 XLSX 형태로 가져오기
    const response = await fetch(SHEET_EXPORT_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error("데이터를 가져오는데 실패했습니다.");

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 시트 이름으로 데이터 찾기
    const scheduleSheetName = workbook.SheetNames.find(n => n === "시트1") || workbook.SheetNames[0];
    const settingSheetName = workbook.SheetNames.find(n => n === "설정");

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

    // ====================================================================
    // 설정 시트 파싱 로직
    // ====================================================================
    const defaultBlockSettings: Record<string, Record<string, number[]>> = {};
    const globalMeetingBlocks: Record<string, number[]> = {};
    const teacherDepts: Record<string, string> = {};

    if (settingSheetName) {
      const settingSheet = workbook.Sheets[settingSheetName];
      const sValues: string[][] = XLSX.utils.sheet_to_json(settingSheet, { header: 1, defval: "" });

      for (let i = 1; i < sValues.length; i++) {
        // 1. A~C열 (0, 1, 2) : 교사별 교체 불가 설정
        const tNameRaw = sValues[i][0];
        if (tNameRaw) {
          const tName = extractName(tNameRaw);
          const tDayStr = sValues[i][1] !== undefined && sValues[i][1] !== "" ? sValues[i][1].toString().trim() : "";
          const tPeriodsStr = sValues[i][2] !== undefined && sValues[i][2] !== "" ? sValues[i][2].toString().trim() : "";

          if (tDayStr === "" || tPeriodsStr === "") {
            continue; // 빈칸이면 교체 불가 설정을 적용하지 않음 (무시)
          }

          if (!defaultBlockSettings[tName]) defaultBlockSettings[tName] = {};

          let targetDays = (tDayStr === "전체")
            ? validDays
            : tDayStr.split(",").map(d => d.trim()).filter(d => validDays.includes(d));

          if (targetDays.length === 0 && validDays.includes(tDayStr)) {
             targetDays = [tDayStr];
          }
          const targetPeriods = (tPeriodsStr === "전체")
            ? periods
            : tPeriodsStr.split(",").map(p => parseInt(p.trim())).filter(p => !isNaN(p));

          targetDays.forEach(d => {
            if (validDays.includes(d)) {
              if (!defaultBlockSettings[tName][d]) defaultBlockSettings[tName][d] = [];
              defaultBlockSettings[tName][d] = Array.from(new Set([...defaultBlockSettings[tName][d], ...targetPeriods])).sort((a, b) => a - b);
            }
          });
        }

        // 2. E~F열 (4, 5) : 협의회 불가 요일/교시 설정
        if (sValues[i].length > 4) {
          const mDayRaw = sValues[i][4];
          if (mDayRaw && mDayRaw.toString().trim() !== "") {
            const mDayStr = mDayRaw.toString().trim();
            const mPeriodsStr = sValues[i][5] !== undefined && sValues[i][5] !== "" ? sValues[i][5].toString().trim() : "";

            if (mDayStr === "" || mPeriodsStr === "") {
               continue;
            }

            let mTargetDays = (mDayStr === "전체")
              ? validDays
              : mDayStr.split(",").map(d => d.trim()).filter(d => validDays.includes(d));

            if (mTargetDays.length === 0 && validDays.includes(mDayStr)) {
              mTargetDays = [mDayStr];
            }
            const mTargetPeriods = (mPeriodsStr === "전체")
              ? periods
              : mPeriodsStr.split(",").map(p => parseInt(p.trim())).filter(p => !isNaN(p));

            mTargetDays.forEach(d => {
              if (validDays.includes(d)) {
                if (!globalMeetingBlocks[d]) globalMeetingBlocks[d] = [];
                globalMeetingBlocks[d] = Array.from(new Set([...globalMeetingBlocks[d], ...mTargetPeriods])).sort((a, b) => a - b);
              }
            });
          }
        }

        // 3. I~J열 (8, 9) : 교사별 교과군 설정
        if (sValues[i].length > 8) {
          const tNameRawDept = sValues[i][8];
          const deptName = sValues[i].length > 9 ? sValues[i][9] : "";

          if (tNameRawDept && tNameRawDept.toString().trim() !== "") {
            const cleanName = extractName(tNameRawDept);
            if (deptName && deptName.toString().trim() !== "") {
              teacherDepts[cleanName] = deptName.toString().trim();
            }
          }
        }
      }
    }

    return {
      teachers: Array.from(new Set(teacherList)).sort(),
      days: validDays,
      periods,
      tableData,
      defaultBlockSettings,
      globalMeetingBlocks,
      teacherDepts
    };

  } catch (error) {
    console.error("데이터 파싱 에러:", error);
    throw error;
  }
}
