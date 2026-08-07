// 조각/질문을 벡터로 바꿉니다. 이수증 수거의 gemini.ts와 같은 fetch 방식이지만,
// 여기서는 실패를 삼키지 않고 던집니다 — 분석 실패 사유를 화면에 그대로 보여줘야 하기 때문입니다.

import { EMBEDDING_MODEL, EMBEDDING_DIM, EMBED_BATCH } from "./config";
import { describeGeminiError } from "./geminiError";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class EmbedError extends Error {}

/**
 * 요청 속도 제한(429). 잠깐 기다리면 풀리는 "일시적" 오류라, 호출하는 쪽에서
 * 영구 실패와 반드시 구분해서 다뤄야 합니다 — 자료를 failed로 못 박으면
 * 사용자는 파일을 지우고 다시 올리는 수밖에 없게 됩니다.
 */
export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("Gemini 요청이 잠시 몰렸습니다. 잠깐 뒤에 자동으로 이어서 분석합니다.");
  }
}

/** 429 응답에 담겨 오는 권장 대기 시간(예: "17s")을 밀리초로. */
function parseRetryDelay(json: unknown): number {
  const details = (json as { error?: { details?: { "@type"?: string; retryDelay?: string }[] } })?.error?.details ?? [];
  for (const detail of details) {
    if (detail["@type"]?.includes("RetryInfo") && detail.retryDelay) {
      const seconds = Number.parseFloat(detail.retryDelay.replace("s", ""));
      if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 1), 60) * 1000;
    }
  }
  return 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429일 때 서버 안에서 짧게 몇 번 다시 시도합니다. 그래도 안 되면 호출 쪽으로 넘깁니다. */
const RETRY_DELAYS_MS = [2000, 5000, 12000];

/** 코사인 거리는 크기와 무관하지만, 차원을 잘라 쓸 때는 정규화해 두는 편이 안전합니다. */
function normalizeVector(values: number[]): number[] {
  let sum = 0;
  for (const v of values) sum += v * v;
  const length = Math.sqrt(sum);
  if (!length || !Number.isFinite(length)) return values;
  return values.map((v) => v / length);
}

async function callBatchOnce(
  apiKey: string,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const res = await fetch(`${BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIM,
      })),
    }),
  });

  const json = await res.json().catch(() => null);
  if (res.status === 429) {
    throw new RateLimitError(parseRetryDelay(json));
  }
  if (!res.ok) {
    throw new EmbedError(describeGeminiError(res.status, json));
  }

  const embeddings = json?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new EmbedError("임베딩 응답 형식이 예상과 다릅니다.");
  }

  return embeddings.map((e: { values?: number[] }) => {
    const values = e?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
      throw new EmbedError(`임베딩 차원이 ${EMBEDDING_DIM}이 아닙니다.`);
    }
    return normalizeVector(values);
  });
}

async function callBatch(
  apiKey: string,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callBatchOnce(apiKey, texts, taskType);
    } catch (error) {
      if (!(error instanceof RateLimitError) || attempt >= RETRY_DELAYS_MS.length) throw error;
      // 서버가 알려준 대기 시간이 있으면 그걸 쓰고, 없으면 점점 길게 기다립니다.
      await sleep(error.retryAfterMs || RETRY_DELAYS_MS[attempt]);
    }
  }
}

/** 문서 조각 여러 개를 한 번에. 호출 수를 줄이려고 EMBED_BATCH 단위로 묶어 보냅니다. */
export async function embedDocuments(apiKey: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    out.push(...(await callBatch(apiKey, texts.slice(i, i + EMBED_BATCH), "RETRIEVAL_DOCUMENT")));
  }
  return out;
}

/** 질문 하나. 검색용 taskType을 써야 문서 임베딩과 제대로 맞물립니다. */
export async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const [vector] = await callBatch(apiKey, [text], "RETRIEVAL_QUERY");
  return vector;
}
