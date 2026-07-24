import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 아이디 로그인 화면에서 "학교 코드" 대신 학교를 검색해서 고를 수 있게 하는 공개 라우트.
// 학교 이름만 노출하고(조인코드 등 민감 정보 없음) 로그인 전에도 호출되므로 세션 검사가 없습니다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const schools = await prisma.school.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json({ schools });
}
