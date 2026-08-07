// 챗봇 아바타 색. 허브(src/app/page.tsx)의 palette와 같은 이름을 쓰되, 여기서는
// 수강신청 도우미의 톤(앰버 기본 + 스톤 글자)에 맞춘 조합만 골라 씁니다.
//
// Tailwind는 클래스 이름을 빌드 시점에 문자열로 훑기 때문에 `bg-${color}-100` 같은
// 조립은 통하지 않습니다 — 반드시 아래처럼 온전한 클래스 문자열로 적어야 합니다.

import type { Accent } from "@/features/schedule-helper/lib/assistant/config";

export interface AccentStyle {
  /** 아바타 원/사각형 */
  avatar: string;
  /** 내 말풍선 배경 */
  bubble: string;
  /** 선택된 카드 테두리 */
  selected: string;
  /** 강조 글자색 */
  text: string;
  /** 진행률 막대 */
  bar: string;
  /** 보내기 버튼 */
  send: string;
}

export const ACCENT_STYLES: Record<Accent, AccentStyle> = {
  amber: {
    avatar: "bg-amber-100 text-amber-700",
    bubble: "bg-amber-500 text-white",
    selected: "border-amber-400 ring-1 ring-amber-200",
    text: "text-amber-700",
    bar: "bg-amber-500",
    send: "bg-amber-500 hover:bg-amber-400",
  },
  rose: {
    avatar: "bg-rose-100 text-rose-700",
    bubble: "bg-rose-500 text-white",
    selected: "border-rose-400 ring-1 ring-rose-200",
    text: "text-rose-700",
    bar: "bg-rose-500",
    send: "bg-rose-500 hover:bg-rose-400",
  },
  emerald: {
    avatar: "bg-emerald-100 text-emerald-700",
    bubble: "bg-emerald-500 text-white",
    selected: "border-emerald-400 ring-1 ring-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
    send: "bg-emerald-500 hover:bg-emerald-400",
  },
  sky: {
    avatar: "bg-sky-100 text-sky-700",
    bubble: "bg-sky-500 text-white",
    selected: "border-sky-400 ring-1 ring-sky-200",
    text: "text-sky-700",
    bar: "bg-sky-500",
    send: "bg-sky-500 hover:bg-sky-400",
  },
  violet: {
    avatar: "bg-violet-100 text-violet-700",
    bubble: "bg-violet-500 text-white",
    selected: "border-violet-400 ring-1 ring-violet-200",
    text: "text-violet-700",
    bar: "bg-violet-500",
    send: "bg-violet-500 hover:bg-violet-400",
  },
};

export function accentStyle(accent: string): AccentStyle {
  return ACCENT_STYLES[accent as Accent] ?? ACCENT_STYLES.amber;
}
