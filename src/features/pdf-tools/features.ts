// 작업대에서 고르는 기능(체크해서 한 번에 적용하는 것들)의 값과 기본값.

import type { ShrinkLevel } from "./lib/shrink";

export interface Features {
  selOn: boolean; // 선택한 쪽만 저장
  blankOn: boolean; // 빈 페이지 삭제
  threshold: number; // 빈 쪽으로 볼 잉크 비율(%)
  splitOn: boolean; // 나누기
  splitEvery: number;
  shrinkOn: boolean; // 용량 줄이기
  level: ShrinkLevel;
  textOn: boolean; // 텍스트도 TXT로 저장
  divider: boolean; // TXT 에 쪽 구분선 넣기
}

export const DEFAULT_FEATURES: Features = {
  selOn: false,
  blankOn: false,
  threshold: 0.3,
  splitOn: false,
  splitEvery: 2,
  shrinkOn: false,
  level: "balanced",
  textOn: false,
  divider: true,
};

export const LEVELS: { key: ShrinkLevel; label: string; note: string }[] = [
  { key: "light", label: "가볍게", note: "글자 검색 유지 · 구조만 압축" },
  { key: "balanced", label: "균형", note: "글자 검색 유지 · 사진만 줄임" },
  { key: "strong", label: "강하게", note: "글자 검색 안 됨 · 가장 작게" },
];
