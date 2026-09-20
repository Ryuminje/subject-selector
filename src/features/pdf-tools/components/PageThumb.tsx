"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "../lib/pdfjs";

const TILE_RATIO = 1.36; // 타일 높이 / 폭 — 세로형 A4보다 약간 여유

/**
 * 쪽 미리보기 한 장. 화면에 보일 때만 그려서, 수백 쪽짜리 PDF를 열어도 처음부터 다 그리지 않습니다.
 * 회전은 CSS 로만 보여 주고(원본 PDF는 저장할 때 바뀝니다), 90/270도에서는 타일 안에 맞게 줄입니다.
 */
export function PageThumb({
  doc,
  pageNumber,
  width = 120,
  rotation = 0,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width?: number;
  rotation?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        try {
          const page = await doc.getPage(pageNumber);
          if (cancelled || !canvasRef.current) return;
          const r = await renderPage(page, canvasRef.current, width * (window.devicePixelRatio > 1 ? 2 : 1));
          page.cleanup();
          if (!cancelled) {
            setRatio(r);
            setDrawn(true);
          }
        } catch {
          // 문서가 닫힌 뒤(탭을 옮김·파일 교체)에 끝나는 그리기는 무시합니다.
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [doc, pageNumber, width]);

  const tileH = Math.round(width * TILE_RATIO);
  // 타일 안에 들어가는 쪽 크기(회전 전)
  const fitsWide = ratio <= tileH / width;
  const w = fitsWide ? width : tileH / ratio;
  const h = fitsWide ? width * ratio : tileH;
  const turned = rotation % 180 !== 0;
  const scale = turned ? Math.min(width / h, tileH / w, 1) : 1;

  return (
    <div
      ref={wrapRef}
      className="relative grid place-items-center overflow-hidden rounded border border-stone-300 bg-stone-100"
      style={{ width, height: tileH }}
    >
      <canvas
        ref={canvasRef}
        className={`bg-white shadow-sm transition-transform duration-200 ${drawn ? "" : "opacity-0"}`}
        style={{ width: w, height: h, transform: `rotate(${rotation}deg) scale(${scale})` }}
      />
    </div>
  );
}
