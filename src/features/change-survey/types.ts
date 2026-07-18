export type ChangeGradeKey = "grade2" | "grade3";

export type TimetableCell = { subject: string; teacher: string };
export type TimetableGradeData = Record<string, Record<string, TimetableCell>>;
export type TimetableData = { grade2: TimetableGradeData; grade3: TimetableGradeData };
export type GradeStringArrays = { grade2: string[]; grade3: string[] };

// A single elective-change request row (applicant or arbitrary table).
// The index signature keeps the dynamic `{ ...item, [field]: value }` edits
// in ApplicationStep well-typed without forcing casts.
export interface ElectiveChange {
  id: string;
  studentId: string;
  studentName: string;
  beforeSubject: string;
  afterSubject: string;
  isNew?: boolean;
  [key: string]: string | boolean | undefined;
}

// One processed student row produced by the analysis (step6Data) memo.
export interface Step6Row {
  id: string;
  name: string;
  completedBefore: string[];
  currentSubjects: string[];
  currentSubjectsMap: Record<string, string>;
  basicCount: number;
  socialCount: number;
  scienceCount: number;
  duplicateSubjects: string[];
  hierarchyViolations: { subject: string; prereq: string; message: string }[];
}

export type ChangeActiveTab =
  | "basic"
  | "upload"
  | "timetable"
  | "roster"
  | "application"
  | "roster_after"
  | "analysis"
  | "riroschool";
