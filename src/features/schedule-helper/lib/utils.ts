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
  // 이동수업은 과목명 끝에 대문자 **한 글자**가 붙고 바로 괄호가 오는 형태입니다(통합과학A(1-7)).
  // 앞에 또 대문자가 있으면(물리학II(3-2), 화학II(3-4)의 로마숫자 II) 이동수업이 아니므로,
  // 대문자 앞은 대문자가 아닌 글자(또는 문자열 시작)여야 합니다.
  const blockMatch = str.match(/(?:^|[^A-Z])([A-Z])\(/);
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
