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
