import { useState } from "react";
import type { ChangeGradeKey, TimetableData, GradeStringArrays } from "../types";

const initialTimeSlots = ["A", "B", "C", "D", "E", "F", "G"];
const initialColsG2 = Array.from({ length: 9 }, (_, i) => `2-${i + 1}`);
const initialColsG3 = Array.from({ length: 9 }, (_, i) => `3-${i + 1}`);

export function useTimetableData(changeActiveGrade: ChangeGradeKey) {
  const [timeSlots, setTimeSlots] = useState<GradeStringArrays>({
    grade2: [...initialTimeSlots], grade3: [...initialTimeSlots]
  });
  const [classCols, setClassCols] = useState<GradeStringArrays>({
    grade2: [...initialColsG2], grade3: [...initialColsG3]
  });
  const [timetableData, setTimetableData] = useState<TimetableData>({ grade2: {}, grade3: {} });

  const handleTimetablePaste = (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number, field: "subject" | "teacher") => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("Text");
    if (!pastedText) return;

    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== "");
    const newData = { ...timetableData[changeActiveGrade] };

    const currentCols = classCols[changeActiveGrade];
    const currentRows = timeSlots[changeActiveGrade];
    const remainingSlots = currentRows.length - startRowIndex;

    // Auto-detect interleaved format: if pasting on "subject" field
    // and the number of rows is roughly 2x the remaining time slots,
    // treat odd rows as subjects and even rows as teachers.
    if (field === "subject" && rows.length > remainingSlots && rows.length >= remainingSlots * 2) {
      for (let pairIdx = 0; pairIdx < remainingSlots; pairIdx++) {
        const subjectRow = rows[pairIdx * 2];
        const teacherRow = rows[pairIdx * 2 + 1];
        const targetRow = currentRows[startRowIndex + pairIdx];
        if (!targetRow) continue;
        if (!newData[targetRow]) newData[targetRow] = {};

        if (subjectRow) {
          const subjectCells = subjectRow.split('\t');
          subjectCells.forEach((cell, cIdx) => {
            const targetCol = currentCols[startColIndex + cIdx];
            if (targetCol) {
              const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
              newData[targetRow][targetCol] = { ...existingCell, subject: cell.trim() };
            }
          });
        }

        if (teacherRow) {
          const teacherCells = teacherRow.split('\t');
          teacherCells.forEach((cell, cIdx) => {
            const targetCol = currentCols[startColIndex + cIdx];
            if (targetCol) {
              const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
              newData[targetRow][targetCol] = { ...existingCell, teacher: cell.trim() };
            }
          });
        }
      }
    } else {
      // Original single-field paste logic
      rows.forEach((row, rIdx) => {
        const cells = row.split('\t');
        const targetRow = currentRows[startRowIndex + rIdx];
        if (targetRow) {
          if (!newData[targetRow]) newData[targetRow] = {};
          cells.forEach((cell, cIdx) => {
            const targetCol = currentCols[startColIndex + cIdx];
            if (targetCol) {
              const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
              newData[targetRow][targetCol] = { ...existingCell, [field]: cell.trim() };
            }
          });
        }
      });
    }

    setTimetableData(prev => ({
      ...prev,
      [changeActiveGrade]: newData
    }));
  };

  const addTimeSlot = () => {
    setTimeSlots(prev => {
      const current = prev[changeActiveGrade];
      const nextChar = String.fromCharCode(65 + current.length); // A, B, C...
      return { ...prev, [changeActiveGrade]: [...current, nextChar] };
    });
  };

  const addClassCol = () => {
    setClassCols(prev => {
      const current = prev[changeActiveGrade];
      const prefix = changeActiveGrade === "grade2" ? "2-" : "3-";
      return { ...prev, [changeActiveGrade]: [...current, `${prefix}${current.length + 1}`] };
    });
  };

  const removeTimeSlot = (idx: number) => {
    setTimeSlots(prev => {
      const current = [...prev[changeActiveGrade]];
      current.splice(idx, 1);
      return { ...prev, [changeActiveGrade]: current };
    });
  };

  const removeClassCol = (idx: number) => {
    setClassCols(prev => {
      const current = [...prev[changeActiveGrade]];
      current.splice(idx, 1);
      return { ...prev, [changeActiveGrade]: current };
    });
  };

  const updateTimetableCell = (row: string, col: string, field: "subject" | "teacher", value: string) => {
    setTimetableData(prev => ({
      ...prev,
      [changeActiveGrade]: {
        ...prev[changeActiveGrade],
        [row]: {
          ...(prev[changeActiveGrade][row] || {}),
          [col]: {
            ...(prev[changeActiveGrade][row]?.[col] || { subject: "", teacher: "" }),
            [field]: value
          }
        }
      }
    }));
  };

  return {
    timeSlots,
    setTimeSlots,
    classCols,
    setClassCols,
    timetableData,
    setTimetableData,
    handleTimetablePaste,
    addTimeSlot,
    addClassCol,
    removeTimeSlot,
    removeClassCol,
    updateTimetableCell,
  };
}
