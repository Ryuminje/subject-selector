"use client";

import React from "react";
import {
  ChevronRight, Download, FileSearch, FileType2, Files, ListChecks, LockOpen, Minimize2, PencilLine, ScanText, Scissors, type LucideIcon,
} from "lucide-react";
import { LEVELS, type Features } from "../features";

// Tailwind 는 클래스 이름을 소스에서 통째로 찾아 만들기 때문에 색마다 완성된 문자열을 적어 둡니다.
const TILE = {
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
  stone: "bg-stone-200 text-stone-700",
} as const;
type Tone = keyof typeof TILE;

function Tile({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg ${TILE[tone]}`}>
      <Icon className="w-4 h-4" />
    </span>
  );
}

/** 체크해서 적용하는 기능 한 줄. 켜면 아래에 옵션이 펼쳐집니다. */
function ToggleRow({
  icon,
  tone,
  title,
  tip,
  checked,
  onChange,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  tip: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`border-b border-stone-100 last:border-0 ${checked ? "bg-pdf/5" : ""}`}>
      <label title={tip} className="flex items-center gap-2 px-3 py-2 cursor-pointer">
        <Tile icon={icon} tone={tone} />
        <span className="text-sm font-medium text-stone-900 truncate">{title}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="ml-auto w-4 h-4 accent-pdf" />
      </label>
      {checked && children && <div className="px-3 pb-2.5 pl-12 text-xs text-stone-600 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

/** 올린 뒤 바로 쓰는 기능 한 줄(체크 없음). 어떻게 쓰는지를 짧은 표로 알려 줍니다. */
function GuideRow({ icon, tone, title, tip, hint }: { icon: LucideIcon; tone: Tone; title: string; tip: string; hint: string }) {
  return (
    <div title={tip} className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 last:border-0">
      <Tile icon={icon} tone={tone} />
      <span className="text-sm font-medium text-stone-900 truncate">{title}</span>
      <span className="ml-auto shrink-0 text-[11px] text-stone-500 bg-stone-100 rounded-md px-1.5 py-0.5">{hint}</span>
    </div>
  );
}

export function FeaturePanel({
  f,
  set,
  scan,
  selectedCount,
  parts,
  summary,
  finalCount,
  runLabel,
  canRun,
  onRun,
  onDocument,
}: {
  f: Features;
  set: (patch: Partial<Features>) => void;
  scan: { scanning: boolean; done: number; total: number; candidates: number };
  selectedCount: number;
  parts: number;
  summary: string[];
  finalCount: number;
  runLabel: string;
  canRun: boolean;
  onRun: () => void;
  onDocument: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold tracking-wider text-stone-500">기능</p>
        <p className="text-sm font-bold text-stone-900">필요한 것만 골라 한 번에</p>
      </div>

      <div className="bg-white border border-[#E2DCCC] rounded-[14px] overflow-hidden shadow-sm">
        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-stone-400">체크해서 적용</p>

        <ToggleRow icon={FileSearch} tone="rose" title="빈 페이지 삭제" tip="글자·그림이 거의 없는 쪽을 찾아 지웁니다" checked={f.blankOn} onChange={(v) => set({ blankOn: v })}>
          <span>{scan.scanning ? `쪽을 살펴보는 중… ${scan.done} / ${scan.total}` : `후보 ${scan.candidates}쪽 · 미리보기의 「삭제/유지」로 바꿀 수 있어요`}</span>
          <label className="flex items-center gap-2 whitespace-nowrap">
            민감도
            <input type="range" min={0} max={3} step={0.05} value={f.threshold} onChange={(e) => set({ threshold: Number(e.target.value) })} className="flex-1 min-w-0 accent-rose-500" />
            <span className="tabular-nums w-14 text-right">{f.threshold.toFixed(2)}%</span>
          </label>
        </ToggleRow>

        <ToggleRow icon={Minimize2} tone="emerald" title="용량 줄이기" tip="이메일·업로드 제한에 맞게 가볍게 만듭니다" checked={f.shrinkOn} onChange={(v) => set({ shrinkOn: v })}>
          <div className="flex gap-1">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => set({ level: l.key })}
                className={`flex-1 rounded-lg border py-1 ${f.level === l.key ? "bg-pdf border-pdf text-white" : "bg-white border-stone-300 hover:border-pdf/50"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <span>{LEVELS.find((l) => l.key === f.level)!.note}</span>
        </ToggleRow>

        <ToggleRow icon={Scissors} tone="amber" title="나누기" tip="N쪽씩 나눠 여러 PDF 로 만듭니다(ZIP)" checked={f.splitOn} onChange={(v) => set({ splitOn: v })}>
          <label className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={f.splitEvery}
              onChange={(e) => set({ splitEvery: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              className="w-16 px-2 py-1 border border-stone-300 rounded-lg text-right bg-white text-stone-900"
            />
            쪽씩 → {parts}개 파일 (ZIP)
          </label>
        </ToggleRow>

        <ToggleRow icon={ScanText} tone="sky" title="텍스트 추출" tip="PDF 속 글자를 쪽 순서대로 TXT 로도 저장합니다" checked={f.textOn} onChange={(v) => set({ textOn: v })}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.divider} onChange={(e) => set({ divider: e.target.checked })} className="accent-pdf" />
            쪽 구분선 넣기
          </label>
          <span>스캔본처럼 글자가 없는 PDF는 만들 수 없어요.</span>
        </ToggleRow>

        <ToggleRow icon={ListChecks} tone="violet" title="선택한 쪽만 저장" tip="미리보기에서 고른 쪽만 새 PDF 로 만듭니다" checked={f.selOn} onChange={(v) => set({ selOn: v })}>
          <span>{selectedCount ? `선택한 ${selectedCount}쪽만 새 PDF로 만들어요.` : "미리보기에서 저장할 쪽을 먼저 선택하세요."}</span>
        </ToggleRow>

        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-stone-400 border-t border-stone-100">올린 뒤 바로 쓰는 기능</p>
        <GuideRow icon={Files} tone="amber" title="페이지 정리" tip="여러 PDF 합치기, 끌어서 순서 바꾸기, 회전, 쪽 삭제" hint="미리보기에서" />
        <GuideRow icon={PencilLine} tone="violet" title="내용 편집" tip="쪽을 두 번 누르면 텍스트·형광펜·네모·이미지·서명을 넣을 수 있어요" hint="쪽을 두 번 클릭" />
        <GuideRow icon={LockOpen} tone="stone" title="암호 제거" tip="암호가 걸린 PDF는 올릴 때 암호를 물어 풀고, 편집·인쇄 제한은 자동으로 풀어요" hint="올릴 때 자동" />
        <button
          onClick={onDocument}
          title="DOCX·TXT 파일을 인쇄 창에서 PDF 로 저장합니다. 만든 PDF는 다시 올리면 됩니다"
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 text-left"
        >
          <Tile icon={FileType2} tone="teal" />
          <span className="text-sm font-medium text-stone-900 truncate">문서 변환</span>
          <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[11px] text-stone-500 bg-stone-100 rounded-md px-1.5 py-0.5">
            DOCX·TXT <ChevronRight className="w-3 h-3" />
          </span>
        </button>
      </div>

      <div className="bg-white border border-[#E2DCCC] rounded-[14px] p-3 flex flex-col gap-2 shadow-sm">
        <p className="text-xs text-stone-500">적용 순서 (자동)</p>
        <p className="text-sm font-medium text-stone-900">{summary.length ? `${summary.join(" → ")} → 저장` : "고른 기능이 없어요. 손본 그대로 저장합니다."}</p>
        <p className="text-xs text-stone-500">저장될 쪽: {finalCount}쪽 · 회전·삭제·순서·넣은 내용은 항상 반영돼요.</p>
        <button
          onClick={onRun}
          disabled={!canRun}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-pdf hover:bg-pdf/90 disabled:opacity-40 text-white text-sm font-medium rounded-[10px] border border-pdf/50 shadow-md shadow-pdf/20"
        >
          <Download className="w-4 h-4" /> {runLabel}
        </button>
      </div>
    </div>
  );
}
