"use client";

import { useState } from "react";
import { GripVertical, X } from "lucide-react";

interface RosterTableProps {
  names: string[];
  mode: "preview" | "edit";
  onReorder?: (next: string[]) => void;
  onRemove?: (index: number) => void;
}

interface Row {
  name: string;
  flatIndex: number;
}

export default function RosterTable({ names, mode, onReorder, onRemove }: RosterTableProps) {
  const [dragFlatIndex, setDragFlatIndex] = useState<number | null>(null);
  const [dragOverFlatIndex, setDragOverFlatIndex] = useState<number | null>(null);

  if (names.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">명단이 비어 있습니다.</p>;
  }

  const half = Math.ceil(names.length / 2);
  const left: Row[] = names.slice(0, half).map((name, i) => ({ name, flatIndex: i }));
  const right: Row[] = names.slice(half).map((name, i) => ({ name, flatIndex: half + i }));

  const handleDrop = (targetFlatIndex: number) => {
    if (dragFlatIndex === null || dragFlatIndex === targetFlatIndex || !onReorder) return;
    const next = [...names];
    const [moved] = next.splice(dragFlatIndex, 1);
    const insertIndex = dragFlatIndex < targetFlatIndex ? targetFlatIndex - 1 : targetFlatIndex;
    next.splice(insertIndex, 0, moved);
    onReorder(next);
  };

  const resetDrag = () => {
    setDragFlatIndex(null);
    setDragOverFlatIndex(null);
  };

  // 오른쪽 칸이 왼쪽보다 짧을 때(홀수 인원 — half가 왼쪽에 한 명 더 감) 빈 줄을 채워
  // 두 표의 행 개수를 맞춥니다. padTo에 half를 넘기면 왼쪽 표에서는 항상 0으로 계산됩니다.
  const renderTable = (rows: Row[], padTo: number) => {
    const padCount = Math.max(0, padTo - rows.length);
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5 w-10">번호</th>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5">성명</th>
            <th className="border border-slate-300 bg-[#1a237e] text-white py-1.5 w-16">
              {mode === "edit" ? "관리" : "서명"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              draggable={mode === "edit"}
              onDragStart={() => setDragFlatIndex(row.flatIndex)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverFlatIndex(row.flatIndex);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(row.flatIndex);
                resetDrag();
              }}
              onDragEnd={resetDrag}
              className={
                mode === "edit"
                  ? `cursor-grab active:cursor-grabbing ${dragOverFlatIndex === row.flatIndex ? "bg-cert/8" : ""}`
                  : undefined
              }
            >
              <td className="border border-slate-300 text-center py-2 text-slate-500">{row.flatIndex + 1}</td>
              <td className="border border-slate-300 text-center py-2 font-bold">{row.name}</td>
              <td className="border border-slate-300 text-center py-2">
                {mode === "edit" ? (
                  <div className="flex items-center justify-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => onRemove?.(row.flatIndex)}
                      className="text-rose-500 hover:bg-rose-100 rounded-full p-0.5 transition-colors"
                      title="제거"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`}>
              <td className="border border-slate-300 py-2">&nbsp;</td>
              <td className="border border-slate-300 py-2">&nbsp;</td>
              <td className="border border-slate-300 py-2">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderTable(left, half)}
      {renderTable(right, half)}
    </div>
  );
}
