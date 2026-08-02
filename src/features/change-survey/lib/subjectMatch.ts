import type { TimetableGradeData } from "../types";

// Shared subject-name normalization/matching used by both the auto-assignment
// algorithm (useElectiveChanges) and the pin-slot picker UI (ElectiveChangeTable),
// so "which slots offer this subject" is always computed the same way.
export function normalizeSubject(subject: string): string {
  return subject.replace(/\s+/g, '')
    .replace(/Ⅰ/g, 'I')
    .replace(/Ⅱ/g, 'II')
    .replace(/Ⅲ/g, 'III')
    .replace(/Ⅳ/g, 'IV');
}

export function subjectExistsInSlot(
  subject: string,
  slot: string,
  gradeTimetable: TimetableGradeData,
  gradeCols: string[],
): boolean {
  const clean = normalizeSubject(subject);
  for (const col of gradeCols) {
    const subj = gradeTimetable[slot]?.[col]?.subject?.trim();
    if (!subj) continue;
    const cleanS = normalizeSubject(subj);
    if (cleanS === clean || cleanS.includes(clean) || clean.includes(cleanS)) return true;
  }
  return false;
}

export function findSlotsWithSubject(
  subject: string,
  gradeTimetable: TimetableGradeData,
  gradeTimeSlots: string[],
  gradeCols: string[],
): string[] {
  if (!subject.trim()) return [];
  return gradeTimeSlots.filter((slot) => subjectExistsInSlot(subject, slot, gradeTimetable, gradeCols));
}
