import type { Metadata } from "next";
import { ScoreAnalyzerApp } from "@/features/score-analyzer/components/ScoreAnalyzerApp";

export const metadata: Metadata = {
  title: "성적 분석기 | 명신고등학교 업무 도구 모음",
  description: "모의고사 성적통지표 PDF를 올리면 영역별 등급·추이·수능 최저 충족 여부를 분석합니다.",
};

// 로그인 없이 쓰고, 파일은 브라우저 안에서만 처리합니다(서버·DB를 쓰지 않습니다).
export default function ScoreAnalyzerPage() {
  return <ScoreAnalyzerApp />;
}
