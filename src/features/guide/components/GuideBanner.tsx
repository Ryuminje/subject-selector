"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BookOpen, X } from "lucide-react";

// 허브 첫 화면의 "처음이세요?" 안내. 닫으면 이 브라우저에서는 다시 뜨지 않습니다.
// localStorage 는 막혀 있을 수 있으므로(시크릿 창 등) 읽기·쓰기 모두 try/catch 로 감쌉니다.
const KEY = "guide-banner-dismissed-v1";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// 서버에서는 숨긴 상태로 그려서, 이미 닫은 사람에게 안내가 깜빡이지 않게 합니다.
function getServerSnapshot(): boolean {
  return true;
}

export function GuideBanner() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (dismissed) return null;

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // 저장이 안 되면 이번 방문 동안만 닫힌 채로 둡니다.
    }
    listeners.forEach((l) => l());
  };

  return (
    <div className="mb-6 flex items-center gap-3 flex-wrap rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
      <BookOpen className="w-5 h-5 text-amber-700 shrink-0" />
      <p className="text-sm text-stone-800 flex-1 min-w-[12rem]">
        <b>처음이세요?</b> 3분이면 읽는 요약본이 있어요.
      </p>
      <Link
        href="/guide"
        className="inline-flex items-center px-3 py-1.5 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-colors"
      >
        요약본 보기
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="안내 닫기"
        className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-amber-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
