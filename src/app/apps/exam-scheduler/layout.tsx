import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "시험 시간표 작성 도우미 | 교육평가부",
  description: "명단과 시험 시간표를 바탕으로 시험실 배정, 분반, 결과표를 만듭니다.",
};

export default function ExamSchedulerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 원본 프로젝트는 body 배경이 옅은 회색(--color-surface-muted)이라 흰 카드가 떠 보였습니다.
  // 허브의 body는 흰색이라 그대로 두면 카드 경계가 묻히므로 이 앱에서만 배경을 되돌립니다.
  return <div className="bg-surface-muted min-h-screen">{children}</div>;
}
