import { FileText, GraduationCap, type LucideIcon } from "lucide-react";

export interface HubApp {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export interface HubDepartment {
  name: string;
  description: string;
  icon: LucideIcon;
  apps: HubApp[];
}

export const schoolName = "명신고등학교";
export const introText = "명신고등학교 업무를 위해 필요한 다양한 프로그램 모음입니다.";

export const departments: HubDepartment[] = [
  {
    name: "교육과정부",
    description: "교육과정 편성 및 수강신청 관련 업무 프로그램",
    icon: GraduationCap,
    apps: [
      {
        title: "수강신청 자료 정리 도우미",
        description: "수요조사 · 선택과목 변경 · 수강신청(본조사) 자료를 한 번에 정리합니다.",
        href: "/apps/enrollment-helper",
        icon: FileText,
      },
    ],
  },
];
