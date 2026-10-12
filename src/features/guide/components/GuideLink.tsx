import Link from "next/link";
import { BookOpen } from "lucide-react";

const BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-stone-800 text-sm font-medium rounded-[10px] border border-stone-200 shadow-sm transition-colors";

/**
 * 각 앱 맨 위 줄에 다는 "이 앱 사용법" 링크. slug 는 src/config/guide.ts 의 항목 slug 입니다.
 * slug 를 생략하면 설명서 첫 화면(요약본)으로 갑니다.
 */
export function GuideLink({
  slug,
  label = "사용법",
  className = BASE,
}: {
  slug?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={slug ? `/guide/${slug}` : "/guide"} className={className} title="사용 설명서 보기">
      <BookOpen className="w-4 h-4" />
      {label}
    </Link>
  );
}
