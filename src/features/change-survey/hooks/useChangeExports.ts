import * as XLSX from "xlsx-js-style";
import type { ChangeGradeKey, GradeStringArrays, Step6Row, TimetableData } from "../types";
import type { StudentTimeData } from "../../../types";

interface AdjustmentLogEntry {
  beforeStr: string;
  afterStr: string;
  status: 'success' | 'failed';
  reason?: string;
  source?: 'applicant' | 'arbitrary';
}

const thinBorder = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } }
};

export function useChangeExports(
  changeActiveGrade: ChangeGradeKey,
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] },
  sampleRawData: { grade2: string | null; grade3: string | null },
  timetableData: TimetableData,
  timeSlots: GradeStringArrays,
  classCols: GradeStringArrays,
  adjustmentLog: Record<string, AdjustmentLogEntry[]>,
  electiveChanges: Record<string, any[]>,
  electiveChangesArbitrary: Record<string, any[]>,
  step6Data: Step6Row[],
) {
  const handleExportRoster = (isAfter: boolean) => {
    const wb = XLSX.utils.book_new();
    const grade = changeActiveGrade;
    const allStudents = parsedSampleData[grade] || [];
    const tSlots = timeSlots[grade] || [];
    const cols = classCols[grade] || [];
    const gTimetable = timetableData[grade] || {};

    if (tSlots.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    tSlots.forEach(timeSlot => {
      const colStudents: Record<string, any[]> = {};
      cols.forEach(col => { colStudents[col] = []; });

      const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
      cols.forEach(col => {
        const cellSubject = gTimetable[timeSlot]?.[col]?.subject?.trim();
        if (!cellSubject) return;

        const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
        const base = match ? match[1].trim() : cellSubject;
        const numMatch = cellSubject.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;

        if (!subjectGroups[base]) subjectGroups[base] = [];
        subjectGroups[base].push({ col, num, original: cellSubject });
      });

      Object.values(subjectGroups).forEach(group => {
        group.sort((a, b) => a.num - b.num);
      });

      const studentsByBase: Record<string, any[]> = {};
      allStudents.forEach(student => {
        const chosenSubject = student.timeSlotMap[timeSlot];
        if (!chosenSubject) return;

        let effectiveSubject = chosenSubject;
        if (isAfter) {
          const studentLogs = adjustmentLog[student.id];
          if (studentLogs) {
            let movedInto = null;
            let movedOut = false;
            for (const entry of studentLogs) {
              if (entry.status !== 'success') continue;
              const beforeMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
              const afterMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
              if (beforeMatch && afterMatch) {
                const logBeforeSubject = beforeMatch[1];
                const logBeforeSlot = beforeMatch[2];
                const logAfterSubject = afterMatch[1];
                const logAfterSlot = afterMatch[2];

                if (logBeforeSlot === timeSlot && logBeforeSubject === chosenSubject) {
                  movedOut = true;
                }
                if (logAfterSlot === timeSlot) {
                  movedInto = logAfterSubject;
                }
              }
            }
            if (movedInto) {
              effectiveSubject = movedInto;
            } else if (movedOut) {
              effectiveSubject = '__REMOVED__';
            }
          }
        }
        if (effectiveSubject === '__REMOVED__') return;

        const cleanChosen = effectiveSubject.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();

        let matchedBase = null;
        let matchedPriority = 999;

        for (const base of Object.keys(subjectGroups)) {
          const cleanBase = base.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
          if (cleanBase === cleanChosen) {
            matchedBase = base;
            matchedPriority = 1;
            break;
          }
          if (cleanChosen.includes(cleanBase)) {
            matchedBase = base;
            matchedPriority = 2;
          } else if (cleanBase.includes(cleanChosen) && matchedPriority > 2) {
            matchedBase = base;
            matchedPriority = 3;
          }
        }

        if (matchedBase) {
          if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
          studentsByBase[matchedBase].push(student);
        }
      });

      Object.keys(subjectGroups).forEach(base => {
        const students = studentsByBase[base] || [];
        students.sort((a, b) => {
          const numA = parseInt(a.id) || 0;
          const numB = parseInt(b.id) || 0;
          return numA - numB;
        });

        const group = subjectGroups[base];
        const numClasses = group.length;
        if (numClasses === 0) return;

        const baseSize = Math.floor(students.length / numClasses);
        let remainder = students.length % numClasses;

        let studentIndex = 0;
        group.forEach(classInfo => {
          let classSize = baseSize;
          if (remainder > 0) {
            classSize += 1;
            remainder -= 1;
          }
          const assigned = students.slice(studentIndex, studentIndex + classSize);
          colStudents[classInfo.col] = assigned;
          studentIndex += classSize;
        });
      });

      const maxRows = Math.max(0, ...Object.values(colStudents).map(arr => arr.length));
      const wsData: any[][] = [];

      const row1: any[] = ["과목명"];
      const row2: any[] = ["강의실"];
      const row3: any[] = ["교사"];
      const row4: any[] = ["순번"];
      const merges: any[] = [];

      let currentColIdx = 1;
      cols.forEach((col) => {
        const teacher = gTimetable[timeSlot]?.[col]?.teacher || "-";
        const subject = gTimetable[timeSlot]?.[col]?.subject || "-";

        row1.push(subject, "");
        row2.push(col, "");
        row3.push(teacher, "");
        row4.push("학번", "이름");

        merges.push({ s: { r: 0, c: currentColIdx }, e: { r: 0, c: currentColIdx + 1 } });
        merges.push({ s: { r: 1, c: currentColIdx }, e: { r: 1, c: currentColIdx + 1 } });
        merges.push({ s: { r: 2, c: currentColIdx }, e: { r: 2, c: currentColIdx + 1 } });
        currentColIdx += 2;
      });

      wsData.push(row1, row2, row3, row4);

      for (let i = 0; i < maxRows; i++) {
        const dataRow: any[] = [i + 1];
        cols.forEach(col => {
          const student = colStudents[col][i];
          if (student) {
            dataRow.push(student.id, student.name);
          } else {
            dataRow.push("", "");
          }
        });
        wsData.push(dataRow);
      }

      const totalRow: any[] = ["총 인원"];
      let tColIdx = 1;
      cols.forEach(col => {
        const count = colStudents[col].length;
        totalRow.push(`${count}명`, "");
        merges.push({ s: { r: wsData.length, c: tColIdx }, e: { r: wsData.length, c: tColIdx + 1 } });
        tColIdx += 2;
      });
      wsData.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!merges'] = merges;

      for (const cell in ws) {
        if (cell[0] === '!') continue;
        if (!ws[cell].s) ws[cell].s = {};
        ws[cell].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder
        };
      }

      const wscols = [{ wpx: 60 }];
      for (let i = 0; i < cols.length * 2; i++) {
        wscols.push({ wpx: 80 });
      }
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, `${timeSlot}타임`);
    });

    const prefix = grade === 'grade2' ? '2학년' : '3학년';
    const suffix = isAfter ? '5단계_변경후명단' : '3단계_변경전명단';
    XLSX.writeFile(wb, `${prefix}_${suffix}.xlsx`);
  };

  const handleExportAttendanceRoster = () => {
    const wb = XLSX.utils.book_new();
    const grade = changeActiveGrade;
    const allStudents = parsedSampleData[grade] || [];
    const tSlots = timeSlots[grade] || [];
    const cols = classCols[grade] || [];
    const gTimetable = timetableData[grade] || {};

    if (tSlots.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const wsData: any[][] = [];

    const headerRow: any[] = ["학년", "반"];
    tSlots.forEach(t => headerRow.push(`${t}타임`));
    headerRow.push("교사", "타임", "과목");
    for (let i = 1; i <= 34; i++) headerRow.push(`${i}`);
    for (let i = 1; i <= 34; i++) headerRow.push(`학번${i}`);
    wsData.push(headerRow);

    const tempRows: { gradeNum: number, classNum: number, timeSlot: string, row: any[] }[] = [];

    tSlots.forEach(timeSlot => {
      const colStudents: Record<string, any[]> = {};
      cols.forEach(col => { colStudents[col] = []; });

      const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
      cols.forEach(col => {
        const cellSubject = gTimetable[timeSlot]?.[col]?.subject?.trim();
        if (!cellSubject) return;

        const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
        const base = match ? match[1].trim() : cellSubject;
        const numMatch = cellSubject.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;

        if (!subjectGroups[base]) subjectGroups[base] = [];
        subjectGroups[base].push({ col, num, original: cellSubject });
      });

      Object.values(subjectGroups).forEach(group => {
        group.sort((a, b) => a.num - b.num);
      });

      const studentsByBase: Record<string, any[]> = {};
      allStudents.forEach(student => {
        const chosenSubject = student.timeSlotMap[timeSlot];
        if (!chosenSubject) return;

        let effectiveSubject = chosenSubject;
        const studentLogs = adjustmentLog[student.id];
        if (studentLogs) {
          let movedInto = null;
          let movedOut = false;
          for (const entry of studentLogs) {
            if (entry.status !== 'success') continue;
            const beforeMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
            const afterMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
            if (beforeMatch && afterMatch) {
              const logBeforeSubject = beforeMatch[1];
              const logBeforeSlot = beforeMatch[2];
              const logAfterSubject = afterMatch[1];
              const logAfterSlot = afterMatch[2];

              if (logBeforeSlot === timeSlot && logBeforeSubject === chosenSubject) {
                movedOut = true;
              }
              if (logAfterSlot === timeSlot) {
                movedInto = logAfterSubject;
              }
            }
          }
          if (movedInto) {
            effectiveSubject = movedInto;
          } else if (movedOut) {
            effectiveSubject = '__REMOVED__';
          }
        }
        if (effectiveSubject === '__REMOVED__') return;

        const cleanChosen = effectiveSubject.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
        let matchedBase = null;
        let matchedPriority = 999;

        for (const base of Object.keys(subjectGroups)) {
          const cleanBase = base.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
          if (cleanBase === cleanChosen) {
            matchedBase = base;
            matchedPriority = 1;
            break;
          }
          if (cleanChosen.includes(cleanBase)) {
            matchedBase = base;
            matchedPriority = 2;
          } else if (cleanBase.includes(cleanChosen) && matchedPriority > 2) {
            matchedBase = base;
            matchedPriority = 3;
          }
        }

        if (matchedBase) {
          if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
          studentsByBase[matchedBase].push(student);
        }
      });

      Object.keys(subjectGroups).forEach(base => {
        const students = studentsByBase[base] || [];
        students.sort((a, b) => {
          const numA = parseInt(a.id) || 0;
          const numB = parseInt(b.id) || 0;
          return numA - numB;
        });

        const group = subjectGroups[base];
        const numClasses = group.length;
        if (numClasses === 0) return;

        const baseSize = Math.floor(students.length / numClasses);
        let remainder = students.length % numClasses;

        let studentIndex = 0;
        group.forEach(classInfo => {
          let classSize = baseSize;
          if (remainder > 0) {
            classSize += 1;
            remainder -= 1;
          }
          const assigned = students.slice(studentIndex, studentIndex + classSize);
          colStudents[classInfo.col] = assigned;
          studentIndex += classSize;
        });
      });

      cols.forEach(col => {
        const teacher = gTimetable[timeSlot]?.[col]?.teacher || "-";
        const subjectRaw = gTimetable[timeSlot]?.[col]?.subject;
        if (!subjectRaw) return;

        const match = subjectRaw.match(/^(.*?)([\d\s]*)$/);
        const baseSubject = match ? match[1].trim() : subjectRaw;

        const students = colStudents[col] || [];

        let gradeStr = "";
        let classStr = "";
        const colMatch = col.match(/^(\d+)-(\d+)$/);
        if (colMatch) {
          gradeStr = colMatch[1];
          classStr = colMatch[2];
        } else {
          gradeStr = col;
        }

        const row: any[] = [gradeStr, classStr];
        tSlots.forEach(t => {
          if (t === timeSlot) {
            row.push(baseSubject);
          } else {
            row.push("");
          }
        });
        row.push(teacher, timeSlot, baseSubject);

        for (let i = 0; i < 34; i++) {
          row.push(students[i] ? students[i].name : "");
        }
        for (let i = 0; i < 34; i++) {
          row.push(students[i] ? students[i].id : "");
        }

        tempRows.push({
          gradeNum: parseInt(gradeStr) || 0,
          classNum: parseInt(classStr) || 0,
          timeSlot: timeSlot,
          row: row
        });
      });
    });

    tempRows.sort((a, b) => {
      if (a.gradeNum !== b.gradeNum) return a.gradeNum - b.gradeNum;
      if (a.classNum !== b.classNum) return a.classNum - b.classNum;
      return a.timeSlot.localeCompare(b.timeSlot);
    });

    tempRows.forEach(item => wsData.push(item.row));

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    for (const cell in ws) {
      if (cell[0] === '!') continue;
      if (!ws[cell].s) ws[cell].s = {};
      ws[cell].s = {
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      };
    }

    const prefix = grade === 'grade2' ? '2학년' : '3학년';
    XLSX.utils.book_append_sheet(wb, ws, `출석부 명단`);
    XLSX.writeFile(wb, `출석부 표지 명단(${prefix}).xlsx`);
  };

  const handleExportChanges = () => {
    const grade = changeActiveGrade;
    const gradeNum = grade === 'grade2' ? '2' : '3';

    const dataApplicant = electiveChanges[grade] || [];
    const studentsApplicant = Array.from(new Set(dataApplicant.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

    const dataArbitrary = electiveChangesArbitrary[grade] || [];
    const studentsArbitrary = Array.from(new Set(dataArbitrary.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

    const createSheet = (title: string, students: string[], dataSrc: any[], sourceFilter: string) => {
      const rows: any[][] = [];
      const merges: any[] = [];
      let changeIndex = 1;
      let count = 0;

      students.forEach(studentId => {
        const logs = adjustmentLog[studentId] || [];
        const studentName = dataSrc.find(d => d.studentId === studentId)?.studentName || "";
        const validLogs = logs.filter(log => log.status === 'success' && log.source === sourceFilter);

        if (validLogs.length > 0) {
          validLogs.forEach((log, index) => {
            rows.push([
              index === 0 ? changeIndex : "",
              index === 0 ? studentId : "",
              index === 0 ? studentName : "",
              log.beforeStr,
              "→",
              log.afterStr
            ]);
          });

          if (validLogs.length > 1) {
            const startRow = rows.length - validLogs.length + 2;
            const endRow = rows.length + 1;
            merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
            merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
            merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
          }
          changeIndex++;
          count++;
        }
      });

      if (count === 0) return null;

      const wsData = [
        [`${title} (${count}명)`, "", "", "", "", ""],
        ["순번", "학번", "이름", "변경전", "→", "변경후"],
        ...rows
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
      ws['!merges'] = merges;

      for (const cell in ws) {
        if (cell[0] === '!') continue;
        if (!ws[cell].s) ws[cell].s = {};

        const rowIndex = parseInt(cell.replace(/\D/g, '')) - 1;

        ws[cell].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder
        };

        if (rowIndex === 0) {
          ws[cell].s.font = { sz: 16, bold: true };
        } else if (rowIndex === 1) {
          ws[cell].s.font = { bold: true };
        }
      }

      ws['!cols'] = [
        { wpx: 40 },
        { wpx: 70 },
        { wpx: 80 },
        { wpx: 180 },
        { wpx: 30 },
        { wpx: 180 },
      ];

      return ws;
    };

    const wsApplicant = createSheet(`${gradeNum}학년 2학기 수동 신청 변경 내역`, studentsApplicant, dataApplicant, 'applicant');
    const wsArbitrary = createSheet(`${gradeNum}학년 2학기 인원 균등 분배 임의 변경 내역`, studentsArbitrary, dataArbitrary, 'arbitrary');

    if (!wsApplicant && !wsArbitrary) {
      alert("다운로드할 변경 내역이 없습니다.");
      return;
    }

    const wb = XLSX.utils.book_new();
    if (wsApplicant) XLSX.utils.book_append_sheet(wb, wsApplicant, "신청자 변경내역");
    if (wsArbitrary) XLSX.utils.book_append_sheet(wb, wsArbitrary, "임의 변경내역");

    XLSX.writeFile(wb, `${gradeNum}학년_선택과목_변경내역.xlsx`);
  };

  const handleDownloadRiroschool = (grade: "grade2" | "grade3") => {
    const rawData = sampleRawData[grade];
    if (!rawData) {
      alert("원본 엑셀 데이터가 없습니다. 2단계에서 파일을 다시 업로드해주세요.");
      return;
    }

    try {
      const wb = XLSX.read(rawData, { type: "binary" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (json.length < 2) {
        alert("데이터 형식이 올바르지 않습니다.");
        return;
      }

      const subjectHeaders = json[1];
      const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
      const subjectColMap: Record<string, number> = {};

      for (let c = 8; c < subjectHeaders.length; c++) {
        if (subjectHeaders[c]) {
          subjectColMap[norm(String(subjectHeaders[c]).trim())] = c;
        }
      }

      for (let r = 2; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0 || !row[1]) continue;
        const studentId = String(row[1]).trim();

        const logs = adjustmentLog[studentId];
        const hasChanges = logs && logs.some(l => l.status === 'success' && (l.source === 'applicant' || l.source === 'arbitrary'));

        if (hasChanges) {
          const studentInitData = parsedSampleData[grade].find(s => s.id === studentId);
          if (!studentInitData) continue;

          const finalTimeSlotMap = { ...studentInitData.timeSlotMap };

          logs.forEach(l => {
            if (l.status !== 'success' || (l.source !== 'applicant' && l.source !== 'arbitrary')) return;

            let beforeSubj = l.beforeStr;
            let afterSubj = l.afterStr;
            let beforeSlot = "";
            let afterSlot = "";

            const timeSlotsForGrade = timeSlots[grade] || [];
            for (const slot of timeSlotsForGrade) {
              if (l.beforeStr.endsWith(`(${slot})`)) {
                beforeSubj = l.beforeStr.slice(0, -(slot.length + 2));
                beforeSlot = slot;
              }
              if (l.afterStr.endsWith(`(${slot})`)) {
                afterSubj = l.afterStr.slice(0, -(slot.length + 2));
                afterSlot = slot;
              }
            }
            if (!beforeSlot) {
              const match = l.beforeStr.match(/^(.+)\(([^)]+)\)$/);
              if (match) { beforeSubj = match[1]; beforeSlot = match[2]; }
            }
            if (!afterSlot) {
              const match = l.afterStr.match(/^(.+)\(([^)]+)\)$/);
              if (match) { afterSubj = match[1]; afterSlot = match[2]; }
            }

            if (beforeSlot && finalTimeSlotMap[beforeSlot] && norm(finalTimeSlotMap[beforeSlot]) === norm(beforeSubj)) {
              delete finalTimeSlotMap[beforeSlot];
            }
            if (afterSlot) {
              finalTimeSlotMap[afterSlot] = afterSubj;
            }
          });

          const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
          for (let c = 8; c <= range.e.c; c++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (sheet[cellRef]) {
              delete sheet[cellRef];
            }
          }

          Object.entries(finalTimeSlotMap).forEach(([slot, subj]) => {
            const col = subjectColMap[norm(subj)];
            if (col !== undefined) {
              sheet[XLSX.utils.encode_cell({ r, c: col })] = { t: 's', v: slot };
            }
          });
        }
      }

      XLSX.writeFile(wb, `${grade === 'grade2' ? '2학년' : '3학년'}_리로스쿨_업로드용_최종.xlsx`);
    } catch (e) {
      console.error(e);
      alert("엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  const handleExportStep6 = () => {
    if (step6Data.length === 0) return;

    const aoa: any[][] = [];
    const gradeNum = changeActiveGrade === "grade2" ? 2 : 3;

    aoa.push([`${gradeNum}학년 다년도 분석 결과`]);
    const timeSlotsForGrade = timeSlots[changeActiveGrade] || [];

    aoa.push([
      "순번", "학번", "이름", "과거 이수 과목", "2학기 과목", ...timeSlotsForGrade.slice(1).map(() => ""), "기초과목", "사회", "과학", "비고(중복/위계)"
    ]);
    aoa.push([
      "", "", "", "", ...timeSlotsForGrade, "", "", "", ""
    ]);

    step6Data.forEach((student, idx) => {
      const remarks: string[] = [];
      if (student.basicCount >= 10) remarks.push("기초과목 최대학점 초과");
      if (student.duplicateSubjects?.length) remarks.push(`중복: ${student.duplicateSubjects.join(", ")}`);
      if (student.hierarchyViolations?.length) remarks.push(student.hierarchyViolations.map((v: any) => v.message).join(", "));

      aoa.push([
        idx + 1,
        student.id,
        student.name,
        student.completedBefore.join(", "),
        ...timeSlotsForGrade.map(slot => student.currentSubjectsMap?.[slot] || ""),
        student.basicCount || 0,
        student.socialCount || 0,
        student.scienceCount || 0,
        remarks.join(" / ")
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const tc = 4 + timeSlotsForGrade.length;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: tc + 3 } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: tc - 1 } },
      { s: { r: 1, c: tc }, e: { r: 2, c: tc } },
      { s: { r: 1, c: tc + 1 }, e: { r: 2, c: tc + 1 } },
      { s: { r: 1, c: tc + 2 }, e: { r: 2, c: tc + 2 } },
      { s: { r: 1, c: tc + 3 }, e: { r: 2, c: tc + 3 } }
    ];

    ws["!cols"] = [
      { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, ...timeSlotsForGrade.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "다년도분석");
    XLSX.writeFile(wb, `${gradeNum}학년_다년도분석결과.xlsx`);
  };

  const handleExportTimetable = () => {
    const gradeLabel = changeActiveGrade === "grade2" ? "2학년" : "3학년";
    const gradeData = timetableData[changeActiveGrade];
    if (!gradeData) return;

    const cols = classCols[changeActiveGrade] || [];
    const slots = timeSlots[changeActiveGrade] || [];

    const aoa: any[][] = [];

    // Title
    aoa.push([`${gradeLabel} 타임별 시간표`]);
    aoa.push([]);

    // Headers
    const headerRow = ["타임", ...cols];
    aoa.push(headerRow);

    // Data
    slots.forEach(slot => {
      const row1: any[] = [slot]; // Subject row
      const row2: any[] = [""];   // Teacher row
      cols.forEach(col => {
        const subject = gradeData[slot]?.[col]?.subject || "";
        const teacher = gradeData[slot]?.[col]?.teacher || "";

        row1.push(subject);
        row2.push(teacher);
      });
      aoa.push(row1);
      aoa.push(row2);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length } }); // Title

    // Merge time col for each slot
    let currentR = 3;
    slots.forEach(() => {
      merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR + 1, c: 0 } });
      currentR += 2;
    });

    ws["!merges"] = merges;

    // Styles
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    const borderAll = thinBorder;
    const centerAlign = { vertical: "center", horizontal: "center", wrapText: true };
    const headerFill = { fgColor: { rgb: "E0E7FF" } }; // Light Indigo
    const timeColFill = { fgColor: { rgb: "F1F5F9" } }; // Slate 100

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

        ws[cellRef].s = {
          font: { name: "맑은 고딕", sz: 11, color: { rgb: "000000" } },
          alignment: centerAlign,
          border: borderAll
        };

        if (R === 0) {
          ws[cellRef].s.font.sz = 16;
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.border = {};
        } else if (R === 1) {
          ws[cellRef].s.border = {};
        } else if (R === 2) {
          ws[cellRef].s.fill = headerFill;
          ws[cellRef].s.font.bold = true;
        } else if (C === 0 && R > 2) {
          ws[cellRef].s.fill = timeColFill;
          ws[cellRef].s.font.bold = true;
        }

        // Bold the subject row (odd rows starting from 3)
        if (R % 2 === 1 && R >= 3 && C > 0) {
          ws[cellRef].s.font.bold = true;
        }
      }
    }

    // Col width
    const colWidths = [{ wch: 10 }];
    cols.forEach(() => {
      colWidths.push({ wch: 18 });
    });
    ws["!cols"] = colWidths;

    // Row height
    const rowHeights = [];
    for (let i = 0; i <= range.e.r; i++) {
      rowHeights.push({ hpt: 20 });
    }
    ws["!rows"] = rowHeights;

    XLSX.utils.book_append_sheet(wb, ws, "타임별시간표");
    XLSX.writeFile(wb, `${gradeLabel}_타임별시간표.xlsx`);
  };

  return {
    handleExportRoster,
    handleExportAttendanceRoster,
    handleExportChanges,
    handleDownloadRiroschool,
    handleExportStep6,
    handleExportTimetable,
  };
}
