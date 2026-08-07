// 업무 AI 파트너 화면이 서버와 주고받는 모양. 라우트 응답과 1:1로 맞춰 둡니다.

export interface BotSummary {
  id: string;
  name: string;
  tagline: string | null;
  emoji: string;
  accent: string;
  visibility: string;
  ownerName: string;
  updatedAt: string;
  mine: boolean;
  canManage: boolean;
  docCount: number;
  readyCount: number;
  workingCount: number;
  failedCount: number;
}

export interface BotDetail {
  id: string;
  name: string;
  tagline: string | null;
  emoji: string;
  accent: string;
  persona: string | null;
  starters: string[];
  visibility: string;
  ownerName: string;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  byteSize: number;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  embeddedCount: number;
  createdAt: string;
}

export interface Source {
  documentId: string;
  fileName: string;
  page: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  sources: Source[];
  /** 스트리밍 중인 답변인지 — 커서/점 애니메이션 표시에 씁니다. */
  streaming?: boolean;
}
