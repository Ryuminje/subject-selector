// 업무 AI 파트너 — 한곳에 모은 상수. 모델을 바꾸거나 조각 크기를 조정할 때 여기만 고칩니다.

/** 대화 생성 모델. 이수증 수거(gemini.ts)와 같은 모델을 씁니다. */
export const CHAT_MODEL = "gemini-2.5-flash";

/** 임베딩 모델. 출력 차원은 아래 EMBEDDING_DIM으로 잘라 씁니다. */
export const EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * 임베딩 차원. 스키마의 vector(768)과 반드시 같아야 합니다 —
 * 바꾸려면 마이그레이션으로 컬럼 타입도 같이 바꾸고 전체 재분석이 필요합니다.
 */
export const EMBEDDING_DIM = 768;

/** 조각 하나의 목표 길이(문자). 한국어 기준 대략 400~500 토큰. */
export const CHUNK_CHARS = 1100;

/** 조각 사이 겹침. 문장이 경계에서 잘려 근거를 놓치는 걸 줄입니다. */
export const CHUNK_OVERLAP = 150;

/** /ingest 한 번이 처리할 조각 수. Vercel 함수 60초 제한 안에 넉넉히 들어오도록 잡았습니다. */
export const INGEST_BATCH = 60;

/** 임베딩 API 한 번에 보낼 조각 수. */
export const EMBED_BATCH = 20;

/** 질문 하나에 근거로 붙일 조각 수. */
export const TOP_K = 8;

/** 업로드 허용 용량 (바이트). Vercel 요청 본문 한계를 감안해 넉넉하지 않게 잡습니다. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** 챗봇 하나가 가질 수 있는 자료 수 / 계정 하나가 만들 수 있는 챗봇 수. */
export const MAX_DOCS_PER_BOT = 20;
export const MAX_BOTS_PER_USER = 20;

/** 아바타 색 — 허브(src/app/page.tsx) palette와 같은 이름을 씁니다. */
export const ACCENTS = ["amber", "rose", "emerald", "sky", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}
