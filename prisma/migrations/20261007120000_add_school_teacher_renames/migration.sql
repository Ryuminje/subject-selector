-- 관리자가 화면에서 바꾼 교사 이름 내역. 시간표를 다시 업로드할 때 적용해
-- 휴직자 이름으로 되돌아오지 않게 하는 데 쓰입니다.

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "teacherRenames" TEXT NOT NULL DEFAULT '{}';
