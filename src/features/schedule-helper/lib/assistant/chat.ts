// 찾아온 자료 조각을 근거로 답을 만들고, 글자를 스트리밍으로 흘려보냅니다.
//
// 이 기능에서 가장 큰 위험은 "자료에 없는 내용을 그럴듯하게 지어내는 것"입니다. 학교 업무
// 문서는 틀린 답이 곧 업무 사고로 이어지므로, 아래 시스템 지시는 사용자가 정한 말투(persona)
// 보다 항상 뒤에 붙어 덮어쓸 수 없게 되어 있습니다.

import { CHAT_MODEL } from "./config";
import { describeGeminiError } from "./geminiError";
import type { SearchHit } from "./search";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class ChatError extends Error {}

export interface ChatTurn {
  role: "user" | "model";
  content: string;
}

const GROUNDING_RULES = `너는 선생님의 업무 문서를 대신 찾아주는 도우미다. 아래 규칙을 반드시 지켜라.

1. 답변은 오직 <자료>에 주어진 내용만 근거로 삼는다. 일반 상식이나 기억에 의존하지 마라.
2. <자료>에서 답을 찾을 수 없으면 지어내지 말고 "올려주신 자료에서는 확인할 수 없습니다."라고 말하고, 어떤 자료를 더 올리면 답할 수 있을지 한 줄로 덧붙여라.
3. 자료에 조건·예외·기한이 있으면 빠뜨리지 말고 함께 알려라. 규정 문서는 예외 조항이 실제 업무를 좌우한다.
4. 자료의 표현이 애매하면 단정하지 말고 애매하다는 사실을 밝혀라.
5. 한국어 존댓말로, 선생님이 바로 업무에 쓸 수 있게 짧고 구조적으로 답하라. 항목이 여럿이면 번호나 짧은 목록을 쓴다.
6. 답변에 파일명이나 쪽수를 직접 적을 필요는 없다. 근거 자료는 화면에서 따로 표시된다.`;

/** 검색 결과를 프롬프트에 넣을 <자료> 블록으로. */
function buildContext(hits: SearchHit[]): string {
  if (hits.length === 0) return "<자료>\n(관련된 자료를 찾지 못했습니다.)\n</자료>";
  const blocks = hits.map((hit, i) => {
    const where = hit.page ? `${hit.fileName} ${hit.page}쪽` : hit.fileName;
    return `[자료 ${i + 1} · ${where}]\n${hit.content}`;
  });
  return `<자료>\n${blocks.join("\n\n")}\n</자료>`;
}

function buildSystemInstruction(persona: string | null): string {
  // persona를 먼저, 규칙을 나중에 — 사용자가 규칙을 무르게 만들지 못하도록.
  return persona?.trim() ? `${persona.trim()}\n\n${GROUNDING_RULES}` : GROUNDING_RULES;
}

/**
 * Gemini의 SSE 스트림을 글자 조각으로 바꿔 하나씩 내보냅니다.
 * 호출 쪽(라우트)은 이걸 그대로 브라우저로 흘려보내면 됩니다.
 */
export async function* streamAnswer(options: {
  apiKey: string;
  persona: string | null;
  history: ChatTurn[];
  question: string;
  hits: SearchHit[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { apiKey, persona, history, question, hits, signal } = options;

  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
    { role: "user", parts: [{ text: `${buildContext(hits)}\n\n질문: ${question}` }] },
  ];

  const res = await fetch(`${BASE}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(persona) }] },
      contents,
      generationConfig: {
        temperature: 0.2, // 규정 답변이라 표현을 흔들 이유가 없습니다.
        // 문서에서 찾아 옮기는 작업이라 추론 예산을 쓰지 않는 편이 훨씬 빠릅니다.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null);
    throw new ChatError(describeGeminiError(res.status, json));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Gemini는 이벤트 구분자로 CRLF(\r\n\r\n)를 씁니다. 줄바꿈을 먼저 통일해두지 않으면
    // "\n\n"으로는 이벤트가 하나도 나뉘지 않아 답변이 통째로 버퍼에 갇힙니다(실제로 겪은 버그).
    // 버퍼 전체를 매번 정규화하므로 \r 과 \n 이 서로 다른 청크로 쪼개져 와도 안전합니다.
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");

    // SSE는 빈 줄로 이벤트가 끝납니다. 마지막 조각은 아직 안 끝났을 수 있으니 남겨둡니다.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {
          // 조각난 JSON은 무시 — 다음 이벤트에서 온전한 것이 옵니다.
        }
      }
    }
  }
}

/** 대화 목록에서 스레드 제목을 만들 때 쓰는 아주 단순한 요약(첫 질문 자르기). */
export function titleFromQuestion(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length <= 24 ? clean : `${clean.slice(0, 24)}…`;
}
