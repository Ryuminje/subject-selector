"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, RefreshCw } from "lucide-react";
import { avgOf, categoryNames, diffCategory, findCategory, type AvgMetric, type SimBaseline, type SimCategory, type SimPlan } from "../lib/hoursSim";

const METRICS: { key: AvgMetric; label: string }[] = [
  { key: "sem1", label: "1학기 평균시수" },
  { key: "sem2", label: "2학기 평균시수" },
  { key: "year", label: "1년 평균시수" },
];
const CURRENT = "__current__";

interface Column {
  key: string;
  name: string;
  cats: SimCategory[];
}

const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(1));
const deltaOf = (v: number | null, b: number | null) => (v === null || b === null ? null : Math.round((v - b) * 10) / 10);

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="text-stone-400">–</span>;
  if (d === 0) return <span className="text-stone-400">0.0</span>;
  return d > 0 ? <span className="text-red-600 font-medium">▲ {d.toFixed(1)}</span> : <span className="text-blue-600 font-medium">▼ {Math.abs(d).toFixed(1)}</span>;
}

/** 7단계 「안 비교」 — 기준(6단계에서 가져온 표)과 저장한 안들의 교과별 교사 1인당 평균시수를 나란히 봅니다. */
export function HoursCompareView({
  baseline,
  plans,
  currentCats,
  canRebase,
  onRebase,
}: {
  baseline: SimBaseline | null;
  plans: SimPlan[];
  currentCats: SimCategory[];
  canRebase: boolean;
  onRebase: () => void;
}) {
  const [metric, setMetric] = useState<AvgMetric>("year");
  // 기본은 저장한 안 전부. 저장한 안이 없으면 지금 표를 보여 줍니다.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(plans.length ? plans.map((p) => p.id) : [CURRENT]));
  const [open, setOpen] = useState<Set<string>>(new Set());

  if (!baseline) {
    return (
      <div className="py-12 px-6 text-center bg-stone-50 border border-dashed border-stone-300 rounded-2xl flex flex-col items-center gap-3">
        <p className="text-sm text-stone-700">비교의 기준이 없습니다. 기준은 「6단계 결과 가져오기」를 누른 순간의 6단계 표입니다.</p>
        <button
          onClick={onRebase}
          disabled={!canRebase}
          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 text-sm font-medium rounded-xl border border-amber-300 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> 지금 6단계로 기준 잡기
        </button>
        {!canRebase && <p className="text-xs text-stone-500">6단계에 표시할 데이터가 아직 없습니다.</p>}
      </div>
    );
  }

  const columns: Column[] = [
    ...plans.filter((p) => picked.has(p.id)).map((p) => ({ key: p.id, name: p.name, cats: p.cats })),
    ...(picked.has(CURRENT) && currentCats.length ? [{ key: CURRENT, name: "지금 표", cats: currentCats }] : []),
  ];
  const names = categoryNames([baseline.cats, ...columns.map((c) => c.cats)]);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const head = { font: { bold: true }, fill: { fgColor: { rgb: "EEEEEE" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
    const center = { alignment: { horizontal: "center", vertical: "center" } };
    for (const m of METRICS) {
      const aoa: (string | number)[][] = [
        ["교과", "교사 수(기준)", "기준(6단계)", ...columns.flatMap((c) => [c.name, ""])],
        ["", "", "", ...columns.flatMap(() => ["평균", "증감"])],
      ];
      const deltas: (number | null)[][] = [];
      for (const name of names) {
        const base = findCategory(baseline.cats, name);
        const b = avgOf(base, m.key);
        const rowDeltas: (number | null)[] = [];
        const row: (string | number)[] = [name, base ? base.teachers : "–", fmt(b)];
        for (const c of columns) {
          const v = avgOf(findCategory(c.cats, name), m.key);
          const d = deltaOf(v, b);
          rowDeltas.push(d);
          row.push(fmt(v), d === null ? "–" : d > 0 ? `▲ ${d.toFixed(1)}` : d < 0 ? `▼ ${Math.abs(d).toFixed(1)}` : "0.0");
        }
        aoa.push(row);
        deltas.push(rowDeltas);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let r = 0; r <= range.e.r; r++) {
        for (let c = 0; c <= range.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) ws[ref] = { t: "s", v: "" };
          ws[ref].s = r < 2 ? head : { ...center };
          // 증감 칸 글자색: 늘어남 빨강, 줄어듦 파랑
          if (r >= 2 && c >= 4 && (c - 4) % 2 === 0) {
            const d = deltas[r - 2][(c - 4) / 2];
            if (d) ws[ref].s = { ...center, font: { bold: true, color: { rgb: d > 0 ? "DC2626" : "2563EB" } } };
          }
        }
      }
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        ...columns.map((_, i) => ({ s: { r: 0, c: 3 + i * 2 }, e: { r: 0, c: 4 + i * 2 } })),
      ];
      ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, ...columns.flatMap(() => [{ wch: 10 }, { wch: 10 }])];
      XLSX.utils.book_append_sheet(wb, ws, m.label);
    }
    XLSX.writeFile(wb, "교과별_평균시수_안비교.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-600 mr-1">보기</span>
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${metric === m.key ? "bg-amber-500 border-amber-500 text-white shadow" : "bg-white border-stone-300 text-stone-600 hover:border-amber-400"}`}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={exportXlsx}
          disabled={columns.length === 0}
          className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-500/25 flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> 비교표 엑셀 다운로드
        </button>
      </div>

      <div className="bg-white/80 border border-stone-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-stone-800 mr-1">비교할 안</span>
        {plans.map((p) => (
          <label key={p.id} className="inline-flex items-center gap-1.5 text-sm text-stone-700 bg-white border border-stone-300 rounded-lg px-2.5 py-1 cursor-pointer">
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => setPicked((s) => toggle(s, p.id))} className="accent-amber-600" />
            {p.name}
          </label>
        ))}
        <label className={`inline-flex items-center gap-1.5 text-sm bg-white border border-dashed border-stone-300 rounded-lg px-2.5 py-1 ${currentCats.length ? "text-stone-700 cursor-pointer" : "text-stone-400"}`}>
          <input type="checkbox" disabled={!currentCats.length} checked={picked.has(CURRENT)} onChange={() => setPicked((s) => toggle(s, CURRENT))} className="accent-amber-600" />
          지금 표(저장 안 해도 됨)
        </label>
        <span className="ml-auto text-xs text-stone-500">
          기준: {new Date(baseline.savedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}에 가져온 6단계
        </span>
        <button
          onClick={() => window.confirm("지금 6단계 표로 비교 기준을 다시 잡을까요? 7단계 표와 저장한 안은 그대로입니다.") && onRebase()}
          disabled={!canRebase}
          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-xs rounded-lg border border-stone-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 기준 다시 잡기
        </button>
      </div>

      {columns.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-600 bg-stone-50 border border-dashed border-stone-300 rounded-2xl">
          비교할 안을 하나 이상 고르세요. 저장한 안이 없으면 「편집」에서 표를 고친 뒤 새 안으로 저장하세요.
        </p>
      ) : (
        <div className="bg-stone-100 rounded-2xl border border-stone-300 overflow-x-auto shadow-inner">
          <table className="w-full text-sm text-stone-700 tabular-nums">
            <thead className="text-xs text-stone-600 border-b border-stone-300">
              <tr>
                <th rowSpan={2} className="px-3 py-2 border-r border-stone-300">교과</th>
                <th rowSpan={2} className="px-3 py-2 border-r border-stone-300">교사 수</th>
                <th rowSpan={2} className="px-3 py-2 border-r border-stone-300 bg-amber-50">기준<br />(6단계)</th>
                {columns.map((c) => (
                  <th key={c.key} colSpan={2} className="px-3 py-2 border-r border-b border-stone-300">{c.name}</th>
                ))}
              </tr>
              <tr>
                {columns.map((c) => (
                  <React.Fragment key={c.key}>
                    <th className="px-3 py-1.5 border-r border-stone-300 font-medium">평균</th>
                    <th className="px-3 py-1.5 border-r border-stone-300 font-medium">증감</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((name) => {
                const base = findCategory(baseline.cats, name);
                const b = avgOf(base, metric);
                const colCats = columns.map((c) => findCategory(c.cats, name));
                const teacherVaries = colCats.some((c) => c && base && c.teachers !== base.teachers);
                const isOpen = open.has(name);
                const cell = (v: number | null) =>
                  v === null ? "–" : metric === "year" ? (
                    <>
                      {v.toFixed(1)} <span className="text-stone-400 text-xs">({(v / 2).toFixed(1)})</span>
                    </>
                  ) : v.toFixed(1);
                return (
                  <React.Fragment key={name}>
                    <tr onClick={() => setOpen((s) => toggle(s, name))} className="border-b border-stone-300 cursor-pointer hover:bg-white/60" title="눌러서 바뀐 내용 보기">
                      <td className="px-3 py-2 border-r border-stone-300 text-center font-medium whitespace-nowrap">{isOpen ? "▾" : "▸"} {name}</td>
                      <td className="px-3 py-2 border-r border-stone-300 text-center">
                        {base ? base.teachers : "–"}
                        {teacherVaries && <span className="block text-[10px] text-stone-500">(안마다 다름)</span>}
                      </td>
                      <td className="px-3 py-2 border-r border-stone-300 text-center bg-amber-50">{cell(b)}</td>
                      {columns.map((c, i) => {
                        const v = avgOf(colCats[i], metric);
                        return (
                          <React.Fragment key={c.key}>
                            <td className="px-3 py-2 border-r border-stone-300 text-center">{cell(v)}</td>
                            <td className="px-3 py-2 border-r border-stone-300 text-center"><Delta d={deltaOf(v, b)} /></td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-stone-300 bg-white">
                        <td colSpan={3 + columns.length * 2} className="px-4 py-2.5">
                          <div className="flex flex-col gap-2 text-xs text-stone-600">
                            {columns.map((c, i) => (
                              <div key={c.key} className="flex gap-2">
                                <span className="shrink-0 font-semibold text-stone-800 w-24 truncate">{c.name}</span>
                                <span>{diffCategory(base, colCats[i]).join(" · ")}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-500">
        값은 교사 1인당 평균시수입니다(교과 시수에서 수석교사 감축을 뺀 뒤 교사 수로 나눔). 1년 평균 옆 괄호는 학기당 평균. 증감은 빨강 ▲ 늘어남, 파랑 ▼ 줄어듦이고, 교사 수가 0이거나 교과가 없으면 「–」로 둡니다. 교과 줄을 누르면 기준과 무엇이 다른지 펼쳐집니다.
      </p>
    </div>
  );
}
