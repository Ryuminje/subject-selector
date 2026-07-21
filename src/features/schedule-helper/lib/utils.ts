import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseClassInfo(str: string | undefined | null) {
  if (!str) return null;

  const gMatch = str.match(/(\d)학년/);
  const grade = gMatch ? gMatch[1] : '?';

  let classNum = '?';
  const cMatch = str.match(/(?:-(\d+)\)+|\((\d+)\))/);
  if (cMatch) classNum = cMatch[1] || cMatch[2];

  let subject = str;
  const sMatch = str.match(/\d학년\s+(.+?)\s*\(/);
  if (sMatch) subject = sMatch[1].trim();
  else subject = str.replace(/^\d학년\s*/, '').trim();

  let isMovingClass = false;
  let blockGroup = '';
  const blockMatch = str.match(/([A-Z])\(/);
  if (blockMatch) {
    isMovingClass = true;
    blockGroup = blockMatch[1];
  }

  return { grade, classNum, subject, isMovingClass, blockGroup };
}

// 업로드된 시간표에 실제로 등장하는 과목명만 뽑아냅니다 — 관리자가 "과목별 교체 금지"를
// 자유 타이핑하면 SwapTab의 완전일치 비교와 오타로 어긋날 수 있어, 실제 값에서 검색·선택하게 하기 위함입니다.
export function extractSubjects(tableData: { teacher: string; [key: string]: string }[]): string[] {
  const set = new Set<string>();
  tableData.forEach((row) => {
    Object.entries(row).forEach(([key, val]) => {
      if (key === "teacher" || !val) return;
      const info = parseClassInfo(val);
      if (info?.subject) set.add(info.subject);
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}
