"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import {
  namesFromColumn,
  parseRosterWorkbook,
  suggestPresetName,
  type RosterSheet,
} from "@/features/schedule-helper/lib/parseRosterExcel";
import { downloadRosterTemplate } from "@/features/schedule-helper/lib/rosterExcelTemplate";

interface RosterExcelImportProps {
  /** create = 새 명단 초안 만들기, append = 편집 중인 명단에 이어 붙이기 */
  mode: "create" | "append";
  /** append 모드에서 "이미 들어 있는 이름"을 걸러 보여 주기 위해 받습니다. */
  existingNames?: string[];
  onConfirm: (names: string[], suggestedName: string) => void;
  onCancel: () => void;
}

export default function RosterExcelImport({
  mode,
  existingNames = [],
  onConfirm,
  onCancel,
}: RosterExcelImportProps) {
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [sheets, setSheets] = useState<RosterSheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [columnIndex, setColumnIndex] = useState(-1);
  const [skipHeader, setSkipHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sheet = sheets?.[sheetIndex];
  const column = sheet?.columns.find((c) => c.index === columnIndex);
  const names = namesFromColumn(column, skipHeader);
  const alreadyIn = new Set(existingNames);
  const newNames = mode === "append" ? names.filter((n) => !alreadyIn.has(n)) : names;

  // 시트를 바꿀 때마다 그 시트에서 가장 이름 같아 보이는 열로 다시 맞춥니다.
  const selectSheet = (list: RosterSheet[], index: number) => {
    const target = list[index];
    const best = target.bestColumnIndex >= 0 ? target.bestColumnIndex : (target.columns[0]?.index ?? -1);
    setSheetIndex(index);
    setColumnIndex(best);
    setSkipHeader(target.columns.find((c) => c.index === best)?.headerLike ?? false);
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setSheets(null);
    setParsing(true);
    parseRosterWorkbook(file)
      .then((parsed) => {
        const usable = parsed.filter((s) => s.columns.length > 0);
        if (usable.length === 0) {
          setError("이 파일에서는 읽을 수 있는 내용을 찾지 못했습니다. 다른 파일을 선택해 주세요.");
          return;
        }
        // 이름처럼 보이는 열이 있는 시트를 먼저 펼쳐 줍니다(첫 시트가 표지인 파일이 흔합니다).
        const firstUsable = Math.max(0, usable.findIndex((s) => s.bestColumnIndex >= 0));
        setSheets(usable);
        selectSheet(usable, firstUsable);
      })
      .catch(() => setError("엑셀 파일을 읽지 못했습니다. .xlsx, .xls, .csv 파일인지 확인해 주세요."))
      .finally(() => setParsing(false));
  };

  const handleColumn = (index: number) => {
    setColumnIndex(index);
    setSkipHeader(sheet?.columns.find((c) => c.index === index)?.headerLike ?? false);
  };

  return (
    <div className="border-2 border-dashed border-teal-300 rounded-2xl p-4 bg-teal-50/40 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-teal-800 flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4" />
          {mode === "create" ? "엑셀로 새 명단 만들기" : "엑셀에서 이름 이어 붙이기"}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        이름이 적힌 엑셀 파일을 올리면 이름 열을 알아서 찾아 줍니다. 다르게 찾았다면 아래에서 시트와 열을 직접
        고르세요. 빈 칸과 중복된 이름은 자동으로 걸러집니다.
      </p>

      <button
        onClick={downloadRosterTemplate}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline mb-3"
      >
        <Download className="w-3.5 h-3.5" /> 예시 서식 내려받기
      </button>

      <input
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-100 file:text-teal-800 file:font-semibold hover:file:bg-teal-200 file:cursor-pointer cursor-pointer"
      />

      {parsing && (
        <p className="mt-3 text-sm text-teal-700 flex items-center gap-1.5">
          <Loader2 className="w-4 h-4 animate-spin" /> {fileName} 읽는 중…
        </p>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {sheets && sheet && (
        <div className="mt-4 space-y-3">
          {sheets.length > 1 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1.5">시트</div>
              <div className="flex flex-wrap gap-1.5">
                {sheets.map((s, i) => (
                  <button
                    key={s.name}
                    onClick={() => selectSheet(sheets, i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      i === sheetIndex
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-teal-300"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">이름이 있는 열</div>
            <div className="flex flex-wrap gap-1.5">
              {sheet.columns.map((c) => {
                const sample = c.cells.filter(Boolean).slice(0, 3).join(", ");
                return (
                  <button
                    key={c.index}
                    onClick={() => handleColumn(c.index)}
                    title={sample}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors max-w-[16rem] truncate ${
                      c.index === columnIndex
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-teal-300"
                    }`}
                  >
                    {c.letter}열
                    {sample && <span className="font-normal opacity-80"> · {sample}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={skipHeader}
              onChange={(e) => setSkipHeader(e.target.checked)}
              className="w-4 h-4 accent-teal-600"
            />
            첫 줄은 머리글이라 건너뜁니다
            {column?.cells[0] && <span className="text-slate-400">(첫 줄: {column.cells[0]})</span>}
          </label>

          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              불러올 이름 {names.length}명
              {mode === "append" && (
                <span className="font-normal text-slate-500">
                  {" "}
                  · 이미 있는 {names.length - newNames.length}명을 빼고 {newNames.length}명이 추가됩니다
                </span>
              )}
            </div>
            {names.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                이 열에서는 이름을 찾지 못했습니다. 다른 열을 골라 보세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {names.map((n) => (
                  <span
                    key={n}
                    className={`px-2 py-0.5 rounded-md text-xs ${
                      mode === "append" && alreadyIn.has(n)
                        ? "bg-slate-100 text-slate-400 line-through"
                        : "bg-teal-50 text-teal-800"
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-white rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm(newNames, suggestPresetName(fileName))}
              disabled={newNames.length === 0}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {mode === "create" ? `이 ${names.length}명으로 만들기` : `${newNames.length}명 추가하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
