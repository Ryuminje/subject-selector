import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadBotAccess } from "@/features/schedule-helper/lib/assistant/access";
import { isSupportedFile } from "@/features/schedule-helper/lib/assistant/extractText";
import { MAX_FILE_BYTES, MAX_DOCS_PER_BOT } from "@/features/schedule-helper/lib/assistant/config";

// 자료 파일 올리기. 여기서는 저장만 하고, 실제 분석(텍스트 추출 → 조각 → 임베딩)은
// /documents/[docId]/ingest가 여러 번 나눠 처리합니다 — 200쪽짜리 PDF를 한 요청 안에
// 다 끝내려 하면 서버리스 함수 시간 제한에 걸리기 때문입니다.

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await loadBotAccess(id, session.user);
  if (!access) {
    return NextResponse.json({ error: "챗봇을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!access.canManage) {
    return NextResponse.json({ error: "만든 사람만 자료를 추가할 수 있습니다." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 받지 못했습니다." }, { status: 400 });
  }

  if (!isSupportedFile(file.name)) {
    return NextResponse.json(
      { error: "PDF · DOCX · 엑셀 · 텍스트 파일만 올릴 수 있습니다. 한글(hwp) 파일은 PDF로 저장한 뒤 올려주세요." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `파일 크기는 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB 이하여야 합니다.` },
      { status: 413 }
    );
  }

  const docCount = await prisma.assistantDocument.count({ where: { botId: id } });
  if (docCount >= MAX_DOCS_PER_BOT) {
    return NextResponse.json(
      { error: `자료는 챗봇 하나당 ${MAX_DOCS_PER_BOT}개까지 넣을 수 있습니다.` },
      { status: 400 }
    );
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const document = await prisma.assistantDocument.create({
    data: {
      botId: id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: fileBytes.byteLength,
      fileBytes,
      status: "pending",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: document.id });
}
