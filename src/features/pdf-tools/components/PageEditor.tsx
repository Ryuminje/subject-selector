"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Highlighter, ImagePlus, MousePointer2, PenLine, Square, Trash2, Type } from "lucide-react";
import { SignaturePad } from "./SignaturePad";
import { renderPage } from "../lib/pdfjs";
import { renderText, rotBox, type EditObj, type TextMeta } from "../lib/editOps";

const WIDTH = 680; // 쪽을 그리는 화면 폭(px)
const HIGHLIGHTS = ["#facc15", "#86efac", "#f9a8d4", "#93c5fd"];
const BOXES = ["#dc2626", "#111111", "#2563eb"];

type Tool = "select" | "text" | "highlight" | "box";
const TOOLS: { key: Tool; label: string; icon: typeof Type }[] = [
  { key: "select", label: "선택·이동", icon: MousePointer2 },
  { key: "text", label: "텍스트", icon: Type },
  { key: "highlight", label: "형광펜", icon: Highlighter },
  { key: "box", label: "네모 테두리", icon: Square },
];

/** 화면(돌린 쪽)에서 다루는 개체. vrot 는 화면에서 그림 내용이 돌아 보이는 각도(똑바로면 0). */
type VObj = EditObj & { vrot: number };
interface Frame {
  W: number; // 원본 쪽 방향 화면 크기(pt)
  H: number;
  Wv: number; // 사용자가 돌린 뒤의 화면 크기(pt)
  Hv: number;
}

/**
 * 한 쪽에 텍스트·형광펜·네모·이미지·서명을 얹는 창.
 * 저장은 "원본 쪽 방향" 좌표로 하므로, 사용자가 쪽을 돌려 둔 상태에서도 돌려 보이는 화면 그대로 편집하고
 * 확인을 누를 때 원본 방향으로 되돌립니다.
 */
export function PageEditor({
  doc,
  pageIndex,
  rotation,
  objects,
  onDone,
  onCancel,
}: {
  doc: PDFDocumentProxy;
  pageIndex: number;
  rotation: number;
  objects: EditObj[];
  onDone: (objects: EditObj[]) => void;
  onCancel: () => void;
}) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [objs, setObjs] = useState<VObj[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<number | null>(null);
  const [hl, setHl] = useState(HIGHLIGHTS[0]);
  const [boxColor, setBoxColor] = useState(BOXES[0]);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const nextId = useRef(Math.max(0, ...objects.map((o) => o.id)) + 1);
  const drag = useRef<{ id: number; mode: "move" | "resize"; px: number; py: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const drawFrom = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        const base = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        if (cancelled || !canvasRef.current) return;
        const f = { W: base.width, H: base.height, Wv: view.width, Hv: view.height };
        setFrame(f);
        // 저장돼 있던 개체(원본 방향)를 지금 돌려 보이는 화면 기준으로 옮깁니다.
        setObjs(
          objects.map((o) => ({
            ...o,
            ...rotBox(o, rotation, f.W, f.H),
            vrot: o.kind === "image" ? (((o.rot ?? 0) + rotation) % 360) : 0,
          })),
        );
        await renderPage(page, canvasRef.current, Math.round(WIDTH * Math.max(1, window.devicePixelRatio)), rotation);
        page.cleanup();
      } catch {
        if (!cancelled) setError("쪽을 그리지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // 창이 열려 있는 동안 입력값(문서·쪽·회전·처음 개체)은 바뀌지 않습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const k = frame ? WIDTH / frame.Wv : 1;
  const pageH = frame ? frame.Hv * k : 0;
  const current = objs.find((o) => o.id === selected) ?? null;

  const patch = (id: number, next: Partial<VObj>) => setObjs((l) => l.map((o) => (o.id === id ? ({ ...o, ...next } as VObj) : o)));
  const remove = (id: number) => {
    setObjs((l) => l.filter((o) => o.id !== id));
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        setObjs((l) => l.filter((o) => o.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const finish = () => {
    if (!frame) return;
    const back = (360 - rotation) % 360;
    onDone(
      objs.map((v) => {
        const { vrot, ...o } = v;
        const box = rotBox(v, back, frame.Wv, frame.Hv);
        if (o.kind === "image") {
          const rot = (((vrot - rotation) % 360) + 360) % 360;
          return { ...o, ...box, ...(rot ? { rot } : { rot: undefined }) } as EditObj;
        }
        return { ...o, ...box } as EditObj;
      }),
    );
  };

  const at = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };

  const addText = (x: number, y: number) => {
    const meta: TextMeta = { value: "텍스트를 입력하세요", size: 14, color: "#111111" };
    const t = renderText(meta);
    const id = nextId.current++;
    setObjs((l) => [...l, { id, kind: "image", x, y, w: t.w, h: t.h, src: t.src, text: meta, vrot: 0 }]);
    setSelected(id);
    setTool("select");
  };

  const addImage = (src: string, wPx: number, hPx: number, width: number) => {
    if (!frame) return;
    const w = Math.min(width, frame.Wv * 0.8);
    const h = (w * hPx) / wPx;
    const id = nextId.current++;
    setObjs((l) => [...l, { id, kind: "image", x: (frame.Wv - w) / 2, y: (frame.Hv - h) / 2, w, h, src, vrot: 0 }]);
    setSelected(id);
    setTool("select");
  };

  const pickImage = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const s = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bitmap.width * s);
      c.height = Math.round(bitmap.height * s);
      c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      addImage(c.toDataURL("image/png"), c.width, c.height, 160);
    } catch {
      setError("이미지를 읽을 수 없습니다. PNG·JPG 파일을 골라 주세요.");
    }
  };

  // ── 개체 끌기·크기 조절 ──
  const startDrag = (e: React.PointerEvent, o: VObj, mode: "move" | "resize") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(o.id);
    drag.current = { id: o.id, mode, px: e.clientX, py: e.clientY, ox: o.x, oy: o.y, ow: o.w, oh: o.h };
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !frame) return;
    const dx = (e.clientX - d.px) / k;
    const dy = (e.clientY - d.py) / k;
    if (d.mode === "move") {
      patch(d.id, { x: Math.max(0, Math.min(frame.Wv - d.ow, d.ox + dx)), y: Math.max(0, Math.min(frame.Hv - d.oh, d.oy + dy)) });
    } else {
      const target = objs.find((o) => o.id === d.id);
      if (target?.kind === "image") {
        // 그림은 가로세로 비율을 지키며 키웁니다(돌아 있어도 같은 배율).
        const f = Math.max(0.15, (d.ow + dx) / d.ow);
        patch(d.id, { w: d.ow * f, h: d.oh * f });
      } else {
        patch(d.id, { w: Math.max(8, d.ow + dx), h: Math.max(8, d.oh + dy) });
      }
    }
  };
  const endDrag = () => {
    drag.current = null;
  };

  // ── 배경을 눌러 만들기 ──
  const overlayDown = (e: React.PointerEvent) => {
    const p = at(e);
    if (tool === "text") return addText(p.x, p.y);
    if (tool === "highlight" || tool === "box") {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawFrom.current = p;
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    setSelected(null);
  };
  const overlayMove = (e: React.PointerEvent) => {
    const from = drawFrom.current;
    if (!from) return;
    const p = at(e);
    setDraft({ x: Math.min(from.x, p.x), y: Math.min(from.y, p.y), w: Math.abs(p.x - from.x), h: Math.abs(p.y - from.y) });
  };
  const overlayUp = () => {
    if (drawFrom.current && draft && draft.w > 3 && draft.h > 3) {
      const id = nextId.current++;
      setObjs((l) => [...l, { id, kind: "rect", style: tool === "highlight" ? "highlight" : "box", color: tool === "highlight" ? hl : boxColor, vrot: 0, ...draft }]);
      setSelected(id);
    }
    drawFrom.current = null;
    setDraft(null);
  };

  const editText = (o: VObj & { kind: "image" }, next: Partial<TextMeta>) => {
    const meta = { ...o.text!, ...next };
    const t = renderText(meta);
    const turned = o.vrot % 180 !== 0;
    patch(o.id, { src: t.src, w: turned ? t.h : t.w, h: turned ? t.w : t.h, text: meta });
  };

  const palette = tool === "highlight" ? HIGHLIGHTS : tool === "box" ? BOXES : null;
  const paletteValue = tool === "highlight" ? hl : boxColor;

  return (
    <div className="fixed inset-0 z-[3000] bg-black/50 overflow-auto p-4" role="dialog" aria-label={`${pageIndex + 1}쪽 내용 넣기`}>
      <div className="mx-auto max-w-[760px] bg-orange-50 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-stone-900 mr-2">쪽 내용 넣기</p>
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              aria-pressed={tool === t.key}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                tool === t.key ? "bg-violet-500 text-white shadow" : "text-stone-600 hover:bg-white"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
          <button onClick={() => imageInput.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-white">
            <ImagePlus className="w-4 h-4" /> 이미지
          </button>
          <button onClick={() => setSigning(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-white">
            <PenLine className="w-4 h-4" /> 서명
          </button>
          <input
            ref={imageInput}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickImage(f);
              e.target.value = "";
            }}
          />
          {palette && (
            <span className="flex items-center gap-1.5 ml-1">
              {palette.map((c) => (
                <button
                  key={c}
                  onClick={() => (tool === "highlight" ? setHl(c) : setBoxColor(c))}
                  aria-label={`색 ${c}`}
                  className={`w-6 h-6 rounded-full border-2 ${paletteValue === c ? "border-stone-800" : "border-white shadow"}`}
                  style={{ background: c }}
                />
              ))}
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-xl border border-stone-300">
              취소
            </button>
            <button onClick={finish} className="px-4 py-2 bg-pdf hover:bg-pdf/90 text-white text-sm font-medium rounded-xl shadow-md shadow-pdf/20">
              확인
            </button>
          </span>
        </div>

        {current && (
          <div className="bg-white/90 border border-violet-200 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
            {current.kind === "image" && current.text && (
              <>
                <textarea
                  value={current.text.value}
                  onChange={(e) => editText(current, { value: e.target.value })}
                  rows={2}
                  className="w-56 p-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-900"
                  aria-label="넣을 텍스트"
                />
                <label className="flex items-center gap-1.5 text-sm text-stone-600">
                  크기
                  <input
                    type="number"
                    min={6}
                    max={120}
                    value={current.text.size}
                    onChange={(e) => editText(current, { size: Math.max(6, Math.min(120, Number(e.target.value) || 14)) })}
                    className="w-16 px-2 py-1 border border-stone-300 rounded-lg text-right bg-white text-stone-900"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-stone-600">
                  색
                  <input type="color" value={current.text.color} onChange={(e) => editText(current, { color: e.target.value })} className="w-8 h-8 p-0 border-0 bg-transparent" />
                </label>
              </>
            )}
            {current.kind === "rect" && (
              <span className="flex items-center gap-1.5 text-sm text-stone-600">
                색
                {(current.style === "highlight" ? HIGHLIGHTS : BOXES).map((c) => (
                  <button
                    key={c}
                    onClick={() => patch(current.id, { color: c })}
                    aria-label={`색 ${c}`}
                    className={`w-6 h-6 rounded-full border-2 ${current.color === c ? "border-stone-800" : "border-white shadow"}`}
                    style={{ background: c }}
                  />
                ))}
              </span>
            )}
            <button onClick={() => remove(current.id)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 text-sm rounded-xl border border-stone-300">
              <Trash2 className="w-4 h-4" /> 삭제
            </button>
          </div>
        )}

        {error && <p className="text-sm rounded-xl px-4 py-3 border bg-rose-50 border-rose-200 text-rose-700">{error}</p>}

        <div className="overflow-auto">
          <div className="relative mx-auto bg-white shadow-lg border border-stone-300" style={{ width: WIDTH, height: pageH || 400 }}>
            <canvas ref={canvasRef} style={{ width: WIDTH, height: pageH || 400 }} className="block" />
            <div
              ref={overlayRef}
              onPointerDown={overlayDown}
              onPointerMove={overlayMove}
              onPointerUp={overlayUp}
              className={`absolute inset-0 touch-none ${tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
            >
              {objs.map((o) => {
                const on = o.id === selected;
                // 돌아 있는 그림은 바깥 상자 안에서 내용 크기(가로세로 바뀜)로 놓고 vrot 만큼 돌립니다.
                const turned = o.vrot % 180 !== 0;
                const cw = (turned ? o.h : o.w) * k;
                const ch = (turned ? o.w : o.h) * k;
                return (
                  <div
                    key={o.id}
                    onPointerDown={(e) => startDrag(e, o, "move")}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    className={`absolute cursor-move ${on ? "outline outline-2 outline-dashed outline-violet-500" : ""}`}
                    style={{
                      left: o.x * k,
                      top: o.y * k,
                      width: o.w * k,
                      height: o.h * k,
                      ...(o.kind === "rect"
                        ? o.style === "highlight"
                          ? { background: o.color, opacity: 0.35 }
                          : { border: `${1.5 * k}px solid ${o.color}` }
                        : {}),
                    }}
                  >
                    {o.kind === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.src}
                        alt=""
                        draggable={false}
                        className="absolute select-none pointer-events-none"
                        style={{ left: (o.w * k - cw) / 2, top: (o.h * k - ch) / 2, width: cw, height: ch, transform: `rotate(${o.vrot}deg)` }}
                      />
                    )}
                    {on && !(o.kind === "image" && o.text) && (
                      <span
                        onPointerDown={(e) => startDrag(e, o, "resize")}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-violet-500 border border-white rounded-sm cursor-nwse-resize"
                      />
                    )}
                  </div>
                );
              })}
              {draft && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: draft.x * k,
                    top: draft.y * k,
                    width: draft.w * k,
                    height: draft.h * k,
                    ...(tool === "highlight" ? { background: hl, opacity: 0.35 } : { border: `${1.5 * k}px solid ${boxColor}` }),
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-500 text-center">
          넣은 텍스트는 그림으로 들어가서 저장한 PDF에서 선택·검색은 되지 않습니다. 형광펜과 네모는 위에 덧그리는 것이라, 아래 내용을 가리거나 지우는 용도로는 쓸 수 없어요.
        </p>
      </div>

      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onDone={(png, w, h) => {
            setSigning(false);
            addImage(png, w, h, 180);
          }}
        />
      )}
    </div>
  );
}
