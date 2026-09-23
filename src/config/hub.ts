import { ArrowLeftRight, Bot, BookOpenCheck, CalendarClock, ClipboardCheck, FileCog, FileText, GraduationCap, HeartHandshake, ScrollText, type LucideIcon } from "lucide-react";

export interface HubApp {
  title: string;
  description: string;
  /** http로 시작하면 바깥 사이트로 보고 새 탭에서 엽니다. */
  href: string;
  icon: LucideIcon;
  /** 남이 만든 프로그램을 링크로 걸 때 밝히는 출처·제작자. */
  credit?: string;
}

/** 우리 앱이 아니라 바깥 사이트인지. */
export function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
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
      {
        title: "PDF 다듬이",
        description: "PDF 합치기·나누기, 용량 줄이기, 암호 제거까지. 파일은 이 브라우저 안에서만 처리됩니다.",
        href: "/apps/schedule-helper/pdf",
        icon: FileCog,
      },
      {
        title: "교과서 선정 초안 작성기",
        description: "교과서 선정 협의 자료 초안을 만들어 줍니다.",
        href: "https://dacisosl.github.io/choice/",
        icon: BookOpenCheck,
        credit: "출처 · 제작: 해밀고 황대연",
      },
    ],
  },
];
