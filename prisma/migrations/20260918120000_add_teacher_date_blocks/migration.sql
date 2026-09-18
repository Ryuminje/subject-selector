-- 특정 "날짜"만 교체 불가로 표시하는 임시 기록 (JSON: Record<"YYYY-MM-DD", 교시[]>).
-- 요일 단위인 tempBlockDays와 달리 그 날 하루만 막히고 다음 주에는 다시 교체 후보로 뜹니다.

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "dateBlocks" TEXT NOT NULL DEFAULT '{}';
