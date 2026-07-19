import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import type { StudentTimeData } from "../../../types";
import type { ChangeGradeKey } from "../types";

export function useChangeUploads(changeActiveGrade: ChangeGradeKey) {
  const [sampleRawData, setSampleRawData] = useState<{ grade2: string | null, grade3: string | null }>({ grade2: null, grade3: null });
  const [parsedSampleData, setParsedSampleData] = useState<{
    grade2: StudentTimeData[],
    grade3: StudentTimeData[]
  }>({ grade2: [], grade3: [] });

  const [grade2HistoryData, setGrade2HistoryData] = useState<Record<string, Record<string, string[]>>>({ grade2: {}, grade3: {} });
  const [grade3Sem1HistoryData, setGrade3Sem1HistoryData] = useState<Record<string, Record<string, string[]>>>({ grade2: {}, grade3: {} });
  const [extraUploads, setExtraUploads] = useState<Record<string, { grade2Optional: boolean; grade3Sem1: boolean }>>({ grade2: { grade2Optional: false, grade3Sem1: false }, grade3: { grade2Optional: false, grade3Sem1: false } });
  const [changeUploadNames, setChangeUploadNames] = useState<Record<string, { timetable: string | null; grade2Optional: string | null; grade3Sem1: string | null }>>({
    grade2: { timetable: null, grade2Optional: null, grade3Sem1: null },
    grade3: { timetable: null, grade2Optional: null, grade3Sem1: null }
  });

  const handleDeleteSampleUpload = () => {
    if (confirm("업로드된 파일을 삭제하시겠습니까?")) {
      setParsedSampleData(prev => ({ ...prev, [changeActiveGrade]: [] }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], timetable: null } }));
    }
  };

  const handleDeleteExtraUpload = (key: 'grade2Optional' | 'grade3Sem1') => {
    if (confirm("업로드된 파일을 삭제하시겠습니까?")) {
      if (key === 'grade2Optional') {
        setGrade2HistoryData(prev => ({ ...prev, [changeActiveGrade]: {} }));
      } else {
        setGrade3Sem1HistoryData(prev => ({ ...prev, [changeActiveGrade]: {} }));
      }
      setExtraUploads(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: false } }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: null } }));
    }
  };

  const handleExtraUpload = (key: 'grade2Optional' | 'grade3Sem1') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const parsedData: Record<string, string[]> = {};

      if (key === 'grade2Optional') {
        if (json.length >= 2) {
          const headers = json[1];
          for (let i = 2; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0 || !row[1] || String(row[1]) === '합계') continue;
            const studentId = String(row[1]).trim();
            const subjects: string[] = [];
            for (let c = 7; c < headers.length; c++) {
              if (row[c] && headers[c]) {
                const subj = String(headers[c]).trim();
                if (subj) subjects.push(subj);
              }
            }
            parsedData[studentId] = subjects;
          }
          setGrade2HistoryData(prev => ({ ...prev, [changeActiveGrade]: parsedData }));
        }
      } else if (key === 'grade3Sem1') {
        if (json.length >= 2) {
          const superHeaders = json[0];
          const headers = json[1];

          for (let i = 2; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0 || !row[1] || String(row[1]) === '합계') continue;
            const studentId = String(row[1]).trim();
            const subjects: string[] = [];

            let currentSuper = "";
            for (let c = 7; c < headers.length; c++) {
              const sHeader = String(superHeaders[c] || "").trim();
              if (sHeader) currentSuper = sHeader;

              if (currentSuper.includes('1학기') || currentSuper.includes('1,2학기')) {
                if (row[c] && headers[c]) {
                  const subj = String(headers[c]).trim();
                  if (subj) subjects.push(subj);
                }
              }
            }
            parsedData[studentId] = subjects;
          }
          setGrade3Sem1HistoryData(prev => ({ ...prev, [changeActiveGrade]: parsedData }));
        }
      }

      setExtraUploads(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: true } }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: file.name } }));
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleChangeSampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string;
      setSampleRawData(prev => ({ ...prev, [changeActiveGrade]: bstr }));
      const wb = XLSX.read(bstr, { type: "binary" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];

      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (json.length < 2) return;

      const subjectHeaders = json[1];
      const students: StudentTimeData[] = [];

      for (let r = 2; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0 || !row[1]) continue;

        const id = String(row[1]).trim();
        const name = String(row[2] || "");

        const timeSlotMap: Record<string, string> = {};
        for (let c = 8; c < row.length; c++) {
          const timeVal = row[c];
          if (timeVal !== undefined && timeVal !== null && subjectHeaders[c]) {
            const timeKey = String(timeVal).trim();
            if (timeKey) {
              timeSlotMap[timeKey] = String(subjectHeaders[c]).trim();
            }
          }
        }

        students.push({ id, name, timeSlotMap });
      }

      setParsedSampleData(prev => ({
        ...prev,
        [changeActiveGrade]: students
      }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], timetable: file.name } }));

      alert(`${changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 데이터 ${students.length}명 파싱 완료!`);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return {
    sampleRawData, setSampleRawData,
    parsedSampleData, setParsedSampleData,
    grade2HistoryData, setGrade2HistoryData,
    grade3Sem1HistoryData, setGrade3Sem1HistoryData,
    extraUploads, setExtraUploads,
    changeUploadNames, setChangeUploadNames,
    handleDeleteSampleUpload,
    handleDeleteExtraUpload,
    handleExtraUpload,
    handleChangeSampleUpload,
  };
}
