"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { departments } from "@/config/hub";

// 같은 부서(쌤스 헬퍼)에 속한 앱들을 오가는 드롭다운.
//
// 앱이 늘어날 때마다 각 화면 헤더에 링크를 하나씩 늘리던 것을 대체합니다.
// **목록의 단일 소스는 src/config/hub.ts입니다** — 새 앱을 허브에 등록하면
// 이 드롭다운에도 자동으로 나타나므로, 화면마다 링크를 손볼 필요가 없습니다.

// 2026-08-30 디자인 개편: 앱 3개가 각자 고유 강조색을 씁니다(globals.css의
// --color-swap/--color-cert/--color-assist 토큰). 예전엔 시간표 교체와 이수증 수거가
// 둘 다 teal이라 색만 보고는 구분이 안 됐습니다.
const TONES = {
  swap: {
    button: "text-stone-500 hover:text-swap border-stone-200",
    icon: "bg-swap/15 text-swap",
    activeRow: "bg-swap/8",
    activeText: "text-swap",
    badge: "bg-swap/15 text-swap",
  },
  cert: {
    button: "text-stone-500 hover:text-cert border-stone-200",
    icon: "bg-cert/15 text-cert",
    activeRow: "bg-cert/8",
    activeText: "text-cert",
    badge: "bg-cert/15 text-cert",
  },
  assist: {
    button: "text-stone-500 hover:text-assist border-stone-200",
    icon: "bg-assist/15 text-assist",
    activeRow: "bg-assist/8",
    activeText: "text-assist",
    badge: "bg-assist/15 text-assist",
  },
} as const;

export type AppSwitcherTone = keyof typeof TONES;

/** 현재 경로가 속한 부서와 앱을 찾습니다. 가장 길게 겹치는 href가 지금 보고 있는 앱입니다. */
function resolveCurrent(pathname: string) {
  for (const department of departments) {
    let best: (typeof department.apps)[number] | null = null;
    for (const app of department.apps) {
      const isMatch = pathname === app.href || pathname.startsWith(`${app.href}/`);
      if (isMatch && (!best || app.href.length > best.href.length)) best = app;
    }
    if (best) return { department, current: best };
  }
  return null;
}

export default function AppSwitcher({ tone = "swap" }: { tone?: AppSwitcherTone }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const style = TONES[tone];

  // 바깥을 누르거나 Esc를 누르면 닫습니다. 마우스를 안 쓰는 경우(터치·키보드)를 위해
  // 호버뿐 아니라 클릭으로도 열리게 해두었기 때문에 이 처리가 필요합니다.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const resolved = resolveCurrent(pathname);
  if (!resolved) return null;

  const { department, current } = resolved;
  // 혼자뿐이면 고를 게 없으니 버튼을 아예 그리지 않습니다.
  if (department.apps.length <= 1) return null;

  const CurrentIcon = current.icon;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-sm font-medium rounded-[10px] border transition-colors ${style.button}`}
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="max-w-[9rem] truncate">{current.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        // 버튼과 메뉴 사이에 틈을 두면 마우스가 지나가다 닫히므로 pt로 간격을 만듭니다.
        <div className="absolute left-0 top-full pt-1.5 z-50">
          <div
            role="menu"
            className="w-[19rem] max-w-[calc(100vw-2rem)] bg-white border border-stone-200 rounded-[14px] shadow-xl p-1.5"
          >
            <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-bold tracking-wider text-stone-400">
              {department.name}
            </p>
            {department.apps.map((app) => {
              const Icon = app.icon;
              const isCurrent = app.href === current.href;
              return (
                <Link
                  key={app.href}
                  href={app.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                    isCurrent ? style.activeRow : "hover:bg-stone-50"
                  }`}
                >
                  <span className={`w-8 h-8 shrink-0 grid place-items-center rounded-[10px] ${style.icon}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-semibold truncate ${isCurrent ? style.activeText : "text-stone-800"}`}
                      >
                        {app.title}
                      </span>
                      {isCurrent && (
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                          현재
                        </span>
                      )}
                    </span>
                    <span className="block mt-0.5 text-xs text-stone-500 leading-snug">{app.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
