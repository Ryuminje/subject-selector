export type ChangeGradeKey = "grade2" | "grade3";

export type TimetableCell = { subject: string; teacher: string };
export type TimetableGradeData = Record<string, Record<string, TimetableCell>>;
export type TimetableData = { grade2: TimetableGradeData; grade3: TimetableGradeData };
export type GradeStringArrays = { grade2: string[]; grade3: string[] };
export type ChangeActiveTab =
  | "basic"
  | "upload"
  | "timetable"
  | "roster"
  | "application"
  | "roster_after"
  | "analysis"
  | "riroschool";
