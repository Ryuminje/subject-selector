export type SubjectCategory = "기초" | "사회" | "과학" | "기타";
export type GradeKey = "pre1" | "grade1" | "grade2";

export interface SubjectMap {
  [subjectName: string]: SubjectCategory;
}

export interface HierarchyRule {
  id: string;
  prereq: string;
  advanced: string;
}

export interface ProcessedStudent {
  originalIndex: number;
  studentId: string;
  name: string;
  grade: string;
  classNum: string;
  num: string;
  semester1: string[];
  semester2: string[];
  basicCount: number;
  socialCount: number;
  scienceCount: number;
  duplicateSubjects: string[];
  hierarchyViolations: { subject: string; prereq: string; message: string }[];
  originalRow: any;
  completedBefore?: string[];
}

export interface StudentTimeData {
  id: string;
  name: string;
  timeSlotMap: Record<string, string>;
}

export interface SubjectStat {
  group: string;
  semester: string;
  subject: string;
  applicants: number;
}

export interface DesignatedSubject {
  subject: string;
  category: SubjectCategory;
  detailedCategory: string;
  isSplit?: boolean;
  sem1: number;
  sem2: number;
}

export interface SelectedSubjectHours {
  subject: string;
  category: SubjectCategory;
  detailedCategory: string;
  sem1: number;
  sem2: number;
}

export interface ParsedCurriculumSubject {
  type: "지정" | "선택";
  subject: string;
  category: string;
  credits: number;
  sem1: number;
  sem2: number;
  semesters: string;
}

export interface ValidationLog {
  studentId: string;
  name: string;
  message: string;
}

export interface ExchangeLogEntry {
  status: 'success' | 'fail';
  beforeStr: string;
  afterStr: string;
  studentA: { id: string, name: string };
  studentB?: { id: string, name: string };
  reason?: string;
}
