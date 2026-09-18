-- 이 도구를 거치지 않고 선생님들끼리 이미 해버린 교체·보강을 손으로 입력한 기록.
-- 시간표 자체를 그 주에 한해 바꿔치기하는 데 쓰입니다.

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "manualChanges" TEXT NOT NULL DEFAULT '[]';
