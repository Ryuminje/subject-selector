"use client";

import React, { useRef, useState } from "react";
import { Eraser, X } from "lucide-react";

/** 마우스·터치·펜으로 서명을 그려 투명 배경 PNG 로 돌려줍니다. */
export function SignaturePad({ onDone, onCancel }: { onDone: (png: string, w: number, h: number) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  const down = (e: React.PointerEvent) => {
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); // 점만 찍어도 보이게
    ctx.stroke();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  const done = () => {
    const c = ref.current!;
    const { width, height } = c;
    const data = c.getContext("2d")!.getImageData(0, 0, width, height).data;
    // 획이 있는 범위만 잘라 넣습니다(여백 없이 크기를 맞추기 위해).
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const pad = 6;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad);
    y1 = Math.min(height - 1, y1 + pad);
    const out = document.createElement("canvas");
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL("image/png"), out.width, out.height);
  };

  return (
    <div className="fixed inset-0 z-[4000] grid place-items-center bg-black/40 p-4" role="dialog" aria-label="서명 그리기">
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xl flex flex-col gap-3">
        <div className="flex items-center">
          <p className="font-bold text-stone-900">서명 그리기</p>
          <button onClick={onCancel} aria-label="닫기" className="ml-auto p-1.5 rounded-lg text-stone-400 hover:bg-stone-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <canvas
          ref={ref}
          width={800}
          height={320}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          className="w-full rounded-xl border border-stone-300 bg-stone-50 touch-none cursor-crosshair"
        />
        <p className="text-xs text-stone-500">칸 안에 서명을 그려 주세요. 배경은 투명하게 들어갑니다.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={clear} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-xl border border-stone-300">
            <Eraser className="w-4 h-4" /> 지우기
          </button>
          <button onClick={done} disabled={empty} className="px-4 py-2 bg-pdf hover:bg-pdf/90 disabled:opacity-40 text-white text-sm font-medium rounded-xl">
            쪽에 넣기
          </button>
        </div>
      </div>
    </div>
  );
}
