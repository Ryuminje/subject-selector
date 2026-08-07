// 뽑아낸 텍스트를 검색 단위(조각)로 자릅니다.
//
// 문단 경계를 최대한 지키고, 조각 사이를 조금 겹쳐 둡니다 — 규정 문서는 한 조항이
// 문단 경계에 걸치는 일이 잦아서, 딱 잘라버리면 정작 필요한 문장만 빠지는 일이 생깁니다.

import { CHUNK_CHARS, CHUNK_OVERLAP } from "./config";
import type { ExtractedPage } from "./extractText";

export interface Chunk {
  ordinal: number;
  page: number | null;
  content: string;
}

/** 공백/빈 줄을 정리 — 임베딩 품질과 저장 용량 양쪽에 도움이 됩니다. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 한 페이지 분량의 글을 목표 길이 근처에서 문단 단위로 자릅니다. */
function splitPage(text: string): string[] {
  const clean = normalize(text);
  if (!clean) return [];
  if (clean.length <= CHUNK_CHARS) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const pieces: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) pieces.push(buffer.trim());
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    // 문단 하나가 목표 길이를 통째로 넘으면 문장 단위로 한 번 더 쪼갭니다.
    if (paragraph.length > CHUNK_CHARS) {
      flush();
      const sentences = paragraph.split(/(?<=[.!?。？！]|다\.)\s+/);
      let sentenceBuffer = "";
      for (const sentence of sentences) {
        if (sentenceBuffer.length + sentence.length > CHUNK_CHARS && sentenceBuffer) {
          pieces.push(sentenceBuffer.trim());
          // 겹침: 앞 조각의 꼬리를 다음 조각 머리에 붙입니다.
          sentenceBuffer = sentenceBuffer.slice(-CHUNK_OVERLAP);
        }
        sentenceBuffer += (sentenceBuffer ? " " : "") + sentence;
      }
      if (sentenceBuffer.trim()) pieces.push(sentenceBuffer.trim());
      continue;
    }

    if (buffer.length + paragraph.length > CHUNK_CHARS && buffer) {
      pieces.push(buffer.trim());
      buffer = buffer.slice(-CHUNK_OVERLAP);
    }
    buffer += (buffer ? "\n\n" : "") + paragraph;
  }
  flush();

  return pieces;
}

/**
 * 페이지 목록을 조각 목록으로. 조각은 자기가 나온 페이지 번호를 그대로 들고 다니며,
 * 그 번호가 나중에 답변 아래 "근거" 칩이 됩니다.
 */
export function chunkPages(pages: ExtractedPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  let ordinal = 0;

  for (const page of pages) {
    for (const content of splitPage(page.text)) {
      chunks.push({ ordinal: ordinal++, page: page.page, content });
    }
  }

  return chunks;
}
