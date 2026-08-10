import { ArrowLeftRight, Bot, CalendarClock, ClipboardCheck, FileText, GraduationCap, HeartHandshake, ScrollText, type LucideIcon } from "lucide-react";

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
  {
    name: "교육평가부",
    description: "시험 운영 및 평가 관련 업무 프로그램",
    icon: ClipboardCheck,
    apps: [
      {
        title: "시험 시간표 작성 도우미",
        description: "명단 · 시간표를 바탕으로 시험실 배정, 분반, 결과표를 한 번에 만듭니다.",
        href: "/apps/exam-scheduler",
        icon: CalendarClock,
      },
    ],
  },
  {
    name: "쌤스 헬퍼 (T-Helper)",
    description: "선생님들의 자잘한 업무를 도와주는 프로그램 모음",
    icon: HeartHandshake,
    apps: [
      {
        title: "시간표 교체 도우미",
        description: "수업 교체 가능한 시간, 협의회 가능 시간을 자동으로 찾아줍니다.",
        href: "/apps/schedule-helper",
        icon: ArrowLeftRight,
      },
      {
        title: "연수 이수증 수거",
        description: "연수 이수증 제출, 조회, QR 서명 수거를 한 곳에서 관리합니다.",
        href: "/apps/schedule-helper/certificates",
        icon: ScrollText,
      },
      {
        title: "업무 AI 파트너",
        description: "업무 자료를 올려두면 그 자료만 근거로 답하는 나만의 챗봇을 만듭니다.",
        href: "/apps/schedule-helper/assistant",
        icon: Bot,
      },
    ],
  },
];
