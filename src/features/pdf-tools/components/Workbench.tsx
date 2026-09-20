"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, PencilLine, Plus, RotateCw, Trash2, X } from "lucide-react";
import { FeaturePanel } from "./FeaturePanel";
import { FileDrop } from "./FileDrop";
import { PageEditor } from "./PageEditor";
import { PageThumb } from "./PageThumb";
import { DEFAULT_FEATURES, type Features } from "../features";
import { inkRatio } from "../lib/blank";
import { documentToHtml, kindOf, mergeToPdf, printHtml } from "../lib/convert";
import { baseName, downloadBlob, downloadPdf } from "../lib/download";
import { closePdf } from "../lib/pdfjs";
import { openSource, runExport, type Item, type Source } from "../lib/workbench";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp";
const TILE = 104;

let seq = 0;

export function Workbench() {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // 기능 선택(왼쪽 목록)
  const [f, setF] = useState<Features>(DEFAULT_FEATURES);
  const set = (patch: Partial<Features>) => setF((prev) => ({ ...prev, ...patch }));
  const [excluded, setExcluded] = useState<Set<string>>(new Set()); // 빈 쪽 후보지만 지우지 않기로 한 쪽
  const [ratios, setRatios] = useState<Record<string, number>>({});

  // 암호 물어보기
  const [pwPrompt, setPwPrompt] = useState<{ name: string; wrong: boolean } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const pwResolver = useRef<((v: string | null) => void) | null>(null);

  const addInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<Source[]>([]);
  const scanned = useRef<Set<string>>(new Set());

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);
  useEffect(() => () => sourcesRef.current.forEach((s) => closePdf(s.view)), []);

  const askPassword = (name: string, wrong: boolean) =>
    new Promise<string | null>((resolve) => {
      pwResolver.current = resolve;
      setPwValue("");
      setPwPrompt({ name, wrong });
    });
  const answerPassword = (value: string | null) => {
    pwResolver.current?.(value);
    pwResolver.current = null;
    setPwPrompt(null);
  };

  const addFiles = async (files: File[]) => {
    setLoading(true);
    setNotice(null);
    const addedSources: Source[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const kind = kindOf(file);
      try {
        if (kind === "docx" || kind === "txt") {
          problems.push(`「${file.name}」은 여기에 올릴 수 없어요. 왼쪽의 「문서 변환」으로 PDF를 만든 뒤 올려 주세요.`);
          continue;
        }
        if (kind !== "pdf" && kind !== "image") {
          problems.push(`「${file.name}」은 지원하지 않는 형식입니다.`);
          continue;
        }
        // 이미지는 A4 쪽에 맞춘 PDF 로 바꿔서 같은 방식으로 다룹니다.
        let bytes: ArrayBuffer;
        if (kind === "image") {
          const pdf = await mergeToPdf([{ file, kind: "image" }], "a4");
          bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
        } else {
          bytes = await file.arrayBuffer();
        }
        const source = await openSource(`s${++seq}`, file.name, bytes, askPassword);
        if (source) addedSources.push(source);
        else problems.push(`「${file.name}」은 암호를 입력하지 않아 건너뛰었습니다.`);
      } catch (err) {
        const message = (err as Error).message;
        problems.push(`「${file.name}」을 열 수 없습니다. ${message.startsWith("암호") || message.startsWith("편집") ? message : "손상되었거나 PDF가 아닐 수 있습니다."}`);
      }
    }
    if (addedSources.length) {
      setSources((prev) => [...prev, ...addedSources]);
      setItems((prev) => [
        ...prev,
        ...addedSources.flatMap((s) =>
          Array.from({ length: s.pages }, (_, index) => ({
            key: `${s.id}-${index}`,
            srcId: s.id,
            index,
            rotation: 0,
            selected: false,
            overlays: [],
          })),
        ),
      ]);
    }
    if (problems.length) setNotice({ error: true, text: problems.join("\n") });
    setLoading(false);
  };

  const removeSource = (id: string) => {
    const gone = sources.find((s) => s.id === id);
    if (gone) closePdf(gone.view);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.filter((i) => i.srcId !== id));
  };

  const reset = () => {
    sources.forEach((s) => closePdf(s.view));
    scanned.current = new Set();
    setSources([]);
    setItems([]);
    setRatios({});
    setExcluded(new Set());
    setNotice(null);
  };

  // ── 쪽 직접 손보기 ──
  const selected = items.filter((i) => i.selected);
  const toggle = (key: string) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, selected: !i.selected } : i)));
  const setAll = (value: boolean) => setItems((prev) => prev.map((i) => ({ ...i, selected: value })));
  const rotateSelected = () => setItems((prev) => prev.map((i) => (i.selected ? { ...i, rotation: (i.rotation + 90) % 360 } : i)));
  const deleteSelected = () => setItems((prev) => prev.filter((i) => !i.selected));
  const move = (from: string, to: string) =>
    setItems((prev) => {
      const a = prev.findIndex((i) => i.key === from);
      const b = prev.findIndex((i) => i.key === to);
      if (a < 0 || b < 0 || a === b) return prev;
      const next = [...prev];
      const [moved] = next.splice(a, 1);
      next.splice(b, 0, moved);
      return next;
    });

  // ── 빈 쪽 찾기: 켜면 아직 재지 않은 쪽만 차례로 잽니다 ──
  useEffect(() => {
    if (!f.blankOn) return;
    const todo = items.filter((i) => !scanned.current.has(i.key));
    if (todo.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const it of todo) {
        const src = sources.find((s) => s.id === it.srcId);
        if (!src) continue;
        let r = 1; // 읽지 못한 쪽은 빈 쪽이 아닌 것으로 봅니다.
        try {
          r = await inkRatio(await src.view.getPage(it.index + 1));
        } catch {
          // 파일을 빼는 중에 문서가 닫히면 오류가 납니다 — 무시합니다.
        }
        if (cancelled) return;
        scanned.current.add(it.key);
        setRatios((prev) => ({ ...prev, [it.key]: r }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [f.blankOn, items, sources]);

  const scanning = f.blankOn && items.some((i) => ratios[i.key] === undefined);
  const candidates = useMemo(
    () => new Set(f.blankOn ? items.filter((i) => ratios[i.key] !== undefined && ratios[i.key] * 100 <= f.threshold).map((i) => i.key) : []),
    [f.blankOn, items, ratios, f.threshold],
  );
  const blankDeletes = (key: string) => candidates.has(key) && !excluded.has(key);
  const finalItems = items.filter((i) => (!f.selOn || i.selected) && !blankDeletes(i.key));

  const chosen = [
    f.selOn && "선택 쪽만",
    f.blankOn && "빈 쪽 삭제",
    f.splitOn && "나누기",
    f.shrinkOn && "용량 줄이기",
    f.textOn && "TXT 추출",
  ].filter(Boolean) as string[];

  const run = async () => {
    setExporting("준비하는 중…");
    setNotice(null);
    try {
      const base = baseName(sources[0].name);
      const { files, notes } = await runExport(
        finalItems.map((i) => ({ srcId: i.srcId, index: i.index, rotation: i.rotation, overlays: i.overlays })),
        new Map(sources.map((s) => [s.id, s.edit])),
        base,
        { split: f.splitOn ? f.splitEvery : null, shrink: f.shrinkOn ? f.level : null, text: f.textOn ? { divider: f.divider } : null },
        setExporting,
      );
      if (files.length === 1) {
        downloadPdf(files[0].data, files[0].name);
      } else {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        files.forEach((file) => zip.file(file.name, file.data));
        downloadBlob(await zip.generateAsync({ type: "blob" }), `${base}_결과.zip`);
      }
      setNotice({
        error: false,
        text: [`${finalItems.length}쪽으로 ${files.length === 1 ? "PDF 하나를" : `파일 ${files.length}개를 ZIP 하나로`} 저장했습니다.`, ...notes].join("\n"),
      });
    } catch (err) {
      setNotice({ error: true, text: `저장하지 못했습니다. ${(err as Error).message}` });
    } finally {
      setExporting(null);
    }
  };

  const printDocument = async (file: File) => {
    const kind = kindOf(file);
    if (kind !== "docx" && kind !== "txt") {
      setNotice({ error: true, text: "DOCX 또는 TXT 파일을 골라 주세요." });
      return;
    }
    try {
      printHtml(baseName(file.name), await documentToHtml(file, kind));
    } catch {
      setNotice({ error: true, text: `「${file.name}」을 읽지 못했습니다. 손상된 파일이거나 옛 형식(.doc)일 수 있습니다.` });
    }
  };

  const editingItem = items.find((i) => i.key === editing) ?? null;
  const editingSource = editingItem ? sources.find((s) => s.id === editingItem.srcId) : null;
  const multi = sources.length > 1;
  const hasFiles = sources.length > 0;

  const runLabel =
    exporting ?? (!hasFiles ? "파일을 먼저 올려 주세요" : scanning ? "빈 쪽을 살펴보는 중…" : finalItems.length === 0 ? "저장할 쪽이 없어요" : "적용하고 저장");

  return (
    <>
      <input ref={docInput} type="file" accept=".docx,.txt" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void printDocument(file); e.target.value = ""; }} />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          {/* 왼쪽: 전체 기능(한 줄씩) */}
          <div>
            <FeaturePanel
              f={f}
              set={set}
              scan={{ scanning, done: items.filter((i) => ratios[i.key] !== undefined).length, total: items.length, candidates: candidates.size }}
              selectedCount={selected.length}
              parts={Math.ceil(finalItems.length / Math.max(1, f.splitEvery))}
              summary={chosen}
              finalCount={finalItems.length}
              runLabel={runLabel}
              canRun={hasFiles && !exporting && !scanning && finalItems.length > 0}
              onRun={run}
              onDocument={() => docInput.current?.click()}
            />
          </div>

          {/* 오른쪽: 올리기 → 미리보기 */}
          {!hasFiles ? (
            <FileDrop
              accept={ACCEPT}
              multiple
              onFiles={(files) => void addFiles(files)}
              title={loading ? "파일을 읽는 중…" : "PDF·이미지를 끌어다 놓거나 눌러서 고르세요"}
              hint="여러 파일은 자동으로 이어 붙여요. 암호가 걸려 있으면 여기서 바로 물어봅니다. 올린 뒤에 왼쪽에서 원하는 기능만 골라 한 번에 적용해요."
            />
          ) : (
            <div className="bg-white border border-[#E2DCCC] rounded-[14px] p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex gap-2 flex-wrap items-center">
                {sources.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-2 bg-pdf/5 border border-pdf/20 rounded-[10px] pl-3 pr-1.5 py-1 text-sm">
                    <span className="max-w-[14rem] truncate">{s.name}</span>
                    <span className="text-xs text-stone-500">{s.pages}쪽</span>
                    {s.note && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5">
                        <Lock className="w-3 h-3" /> {s.note}
                      </span>
                    )}
                    <button onClick={() => removeSource(s.id)} aria-label={`${s.name} 빼기`} className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  ref={addInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                <button onClick={() => addInput.current?.click()} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-sm rounded-[10px] border border-stone-300">
                  <Plus className="w-4 h-4" /> {loading ? "읽는 중…" : "파일 추가"}
                </button>
                <button onClick={reset} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-[10px] border border-[#E2DCCC]">
                  새로 시작
                </button>
              </div>
              <p className="text-xs text-stone-500">
                끌어서 순서를 바꾸고, 쪽을 눌러 선택하세요. 쪽을 두 번 누르면 내용을 넣을 수 있어요.
                {f.blankOn && " 빨간 테두리는 빈 쪽 후보입니다."}
              </p>

              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-stone-500">남은 쪽이 없습니다. 파일을 다시 추가하세요.</p>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-5">
                  {items.map((item, pos) => {
                    const src = sources.find((s) => s.id === item.srcId)!;
                    const candidate = candidates.has(item.key);
                    const dropped = blankDeletes(item.key) || (f.selOn && !item.selected);
                    return (
                      <div
                        key={item.key}
                        draggable
                        onDragStart={() => setDragKey(item.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dragKey && move(dragKey, item.key)}
                        onDragEnd={() => setDragKey(null)}
                        onClick={() => toggle(item.key)}
                        onDoubleClick={() => setEditing(item.key)}
                        className={`relative cursor-pointer select-none text-center text-xs text-stone-500 transition-opacity ${dragKey === item.key || dropped ? "opacity-40" : ""}`}
                        style={{ width: TILE }}
                      >
                        <div className={`rounded ${item.selected ? "ring-2 ring-pdf ring-offset-2" : candidate ? "ring-2 ring-rose-300 ring-offset-1" : ""}`}>
                          <PageThumb doc={src.view} pageNumber={item.index + 1} width={TILE} rotation={item.rotation} />
                        </div>
                        {item.selected && (
                          <span className="absolute -top-2 -right-1 grid place-items-center w-5 h-5 rounded-full bg-pdf text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        {item.overlays.length > 0 && (
                          <span className="absolute -top-2 -left-1 inline-flex items-center gap-0.5 text-[10px] bg-violet-500 text-white rounded-full px-1.5 py-0.5">
                            <PencilLine className="w-2.5 h-2.5" /> {item.overlays.length}
                          </span>
                        )}
                        {candidate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (!next.delete(item.key)) next.add(item.key);
                                return next;
                              });
                            }}
                            className={`absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] rounded-full px-2 py-0.5 text-white shadow ${excluded.has(item.key) ? "bg-stone-500" : "bg-rose-500"}`}
                          >
                            {excluded.has(item.key) ? "유지" : "삭제"}
                          </button>
                        )}
                        <div className="mt-1 truncate" title={multi ? `${src.name} ${item.index + 1}쪽` : undefined}>
                          {pos + 1}
                          {multi && <span className="text-stone-400"> · {src.name}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 flex-wrap items-center border-t border-stone-100 pt-3">
                <button onClick={rotateSelected} disabled={!selected.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-sm rounded-[10px] border border-stone-300">
                  <RotateCw className="w-4 h-4" /> 90° 회전
                </button>
                <button onClick={deleteSelected} disabled={!selected.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 text-stone-700 text-sm rounded-[10px] border border-stone-300">
                  <Trash2 className="w-4 h-4" /> 선택 쪽 삭제
                </button>
                <button onClick={() => selected.length === 1 && setEditing(selected[0].key)} disabled={selected.length !== 1} title="쪽을 하나만 선택하면 열 수 있어요" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40 text-stone-700 text-sm rounded-[10px] border border-stone-300">
                  <PencilLine className="w-4 h-4" /> 선택 쪽에 내용 넣기
                </button>
                <button onClick={() => setAll(selected.length !== items.length)} className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-[10px]">
                  {selected.length === items.length && items.length > 0 ? "선택 해제" : "전체 선택"}
                </button>
                <span className="text-sm text-stone-500">{selected.length}쪽 선택 · 총 {items.length}쪽</span>
              </div>
            </div>
          )}
        </div>

        {notice && (
          <p className={`whitespace-pre-line text-sm rounded-[10px] px-4 py-3 border ${notice.error ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            {notice.text}
          </p>
        )}
      </div>

      {editingItem && editingSource && (
        <PageEditor
          key={editingItem.key}
          doc={editingSource.view}
          pageIndex={editingItem.index}
          rotation={editingItem.rotation}
          objects={editingItem.overlays}
          onCancel={() => setEditing(null)}
          onDone={(overlays) => {
            setItems((prev) => prev.map((i) => (i.key === editingItem.key ? { ...i, overlays } : i)));
            setEditing(null);
          }}
        />
      )}

      {pwPrompt && (
        <div className="fixed inset-0 z-[3500] grid place-items-center bg-black/40 p-4" role="dialog" aria-label="암호 입력">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              answerPassword(pwValue);
            }}
            className="bg-white rounded-[14px] shadow-2xl p-5 w-full max-w-md flex flex-col gap-3"
          >
            <p className="font-bold text-stone-900">암호가 필요한 파일이에요</p>
            <p className="text-sm text-stone-600 break-all">{pwPrompt.name}</p>
            <input
              type="password"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              placeholder="열기 암호"
              autoComplete="off"
              autoFocus
              className={`w-full px-3 py-2 border rounded-[10px] bg-white text-stone-900 ${pwPrompt.wrong ? "border-rose-400" : "border-stone-300"}`}
            />
            {pwPrompt.wrong && <p className="text-sm text-rose-700">암호가 맞지 않습니다. 다시 입력해 주세요.</p>}
            <p className="text-xs text-stone-500">입력한 암호는 이 화면 밖으로 나가지 않고 저장되지도 않습니다. 본인이 열 권한이 있는 파일에만 쓰세요.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => answerPassword(null)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-[10px] border border-stone-300">
                건너뛰기
              </button>
              <button type="submit" disabled={pwValue === ""} className="px-4 py-2 bg-pdf hover:bg-pdf/90 disabled:opacity-40 text-white text-sm font-medium rounded-[10px]">
                풀어서 올리기
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
