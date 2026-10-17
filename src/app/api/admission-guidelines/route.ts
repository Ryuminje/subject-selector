import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGuideline, type Guideline } from "@/features/score-analyzer/lib/guideline";

// 대학별 모집요강 정리 JSON. 읽기는 로그인 없이 누구나(공개 자료), 쓰기는 관리자만.
// 한 번에 올릴 수 있는 건수: 현재 전체가 350건 안팎이라 넉넉히 1,000건.
const MAX_ITEMS = 1000;

export async function GET() {
  try {
    const rows = await prisma.admissionGuideline.findMany({
      orderBy: [{ shortName: "asc" }, { campus: "asc" }, { kind: "asc" }],
      select: { data: true },
    });
    return NextResponse.json(
      { guidelines: rows.map((r) => r.data) },
      // 자주 바뀌는 자료가 아니라 브라우저·CDN 이 잠시 들고 있어도 됩니다.
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ guidelines: [], error: "모집요강을 불러오지 못했습니다." }, { status: 503 });
  }
}

// 올린 모집요강으로 같은 (대학·캠퍼스·구분·학년도) 행을 덮어쓰거나 새로 만듭니다.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "관리자만 올릴 수 있습니다." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { guidelines?: unknown[] } | null;
  if (!body || !Array.isArray(body.guidelines) || !body.guidelines.length) {
    return NextResponse.json({ error: "올릴 모집요강이 없습니다." }, { status: 400 });
  }
  if (body.guidelines.length > MAX_ITEMS) {
    return NextResponse.json({ error: `한 번에 ${MAX_ITEMS}건까지 올릴 수 있습니다.` }, { status: 400 });
  }

  // 항목마다 모양을 확인합니다. 같은 키가 두 번 들어 있으면 뒤의 것만 남깁니다.
  const byKey = new Map<string, Guideline>();
  try {
    for (const raw of body.guidelines) {
      const g = parseGuideline(JSON.stringify(raw));
      if (!Number.isInteger(g.source.admissionYear)) throw new Error("학년도(source.admissionYear)가 숫자가 아닙니다.");
      byKey.set([g.source.admissionYear, g.source.shortName, g.source.campus ?? "", g.source.kind].join("|"), g);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "모집요강 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 원격 DB 라 한 문장으로 몰아서 처리합니다(건건이 보내면 느립니다).
  const rows = [...byKey.values()].map(
    (g) =>
      Prisma.sql`(gen_random_uuid()::text, ${g.source.shortName}, ${g.source.campus ?? ""}, ${g.source.kind}, ${g.source.admissionYear}, ${g.review?.status ?? "미확인"}, ${JSON.stringify(g)}::jsonb, ${session.user.id}, now(), now())`,
  );
  await prisma.$executeRaw`
    INSERT INTO "AdmissionGuideline" ("id","shortName","campus","kind","admissionYear","reviewStatus","data","updatedBy","createdAt","updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("admissionYear","shortName","campus","kind") DO UPDATE SET
      "reviewStatus" = EXCLUDED."reviewStatus", "data" = EXCLUDED."data",
      "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = now()`;

  return NextResponse.json({ saved: rows.length });
}
