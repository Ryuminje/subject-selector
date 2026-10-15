// 성적·상담 메모·입결 자료를 파일 하나로 저장/불러오기. 모두 이 컴퓨터 안에서만 처리하며 서버로 보내지 않습니다.
// 내용은 JSON → 압축(gzip) → (선택) 비밀번호 암호화(AES-GCM) → base64 순서로 담습니다.

import type { NeisStudent } from "./neis";
import type { Report } from "./types";
import type { AdmissionPack } from "./admission";
import type { Guideline } from "./guideline";

export interface Note {
  career: string;
  memo: string;
}
/** 키: `${번호}|${이름}` */
export type Notes = Record<string, Note>;
export const personKey = (num: number, name: string) => `${num}|${name}`;

export interface SaveData {
  reports: Report[];
  naesin: { students: NeisStudent[]; fileName: string };
  files: { name: string; students: number; skipped: number; exam: string }[];
  notes: Notes;
  /** 줄인 입결 자료(없을 수 있음) */
  admission?: AdmissionPack;
  /** 모집요강 정리 JSON(대학별 반영 규칙) */
  guidelines?: Guideline[];
}

interface Envelope {
  app: "score-analyzer";
  v: 1 | 2;
  /** v1: 평문 자료 / v2: base64 문자열 */
  data?: SaveData | string;
  /** 암호화 정보. v1 은 data 도 함께 들어 있습니다. */
  enc?: { salt: string; iv: string; data?: string };
  /** v2: data 가 gzip 으로 압축됨 */
  gz?: boolean;
}

const b64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(t);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const canGzip = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function keyFrom(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encodeSave(data: SaveData, password: string): Promise<Blob> {
  let bytes: Uint8Array = new TextEncoder().encode(JSON.stringify(data));
  const gz = canGzip;
  if (gz) bytes = await pipe(bytes, new CompressionStream("gzip"));
  const env: Envelope = { app: "score-analyzer", v: 2, gz };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(password, salt);
    bytes = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes as BufferSource));
    env.enc = { salt: b64(salt), iv: b64(iv) };
  }
  env.data = b64(bytes);
  return new Blob([JSON.stringify(env)], { type: "application/json" });
}

export function isEncrypted(text: string): boolean {
  try {
    return !!(JSON.parse(text) as Envelope).enc;
  } catch {
    return false;
  }
}

/** 잘못된 파일·틀린 비밀번호면 Error 를 던집니다. */
export async function decodeSave(text: string, password: string): Promise<SaveData> {
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    throw new Error("저장 파일 형식이 아닙니다.");
  }
  if (env.app !== "score-analyzer") throw new Error("성적 분석기에서 저장한 파일이 아닙니다.");
  let data: SaveData | undefined;
  try {
    if (env.v === 1) {
      if (env.enc?.data) {
        const key = await keyFrom(password, unb64(env.enc.salt));
        const buf = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: unb64(env.enc.iv) as BufferSource },
          key,
          unb64(env.enc.data) as BufferSource,
        );
        data = JSON.parse(new TextDecoder().decode(buf));
      } else data = env.data as SaveData;
    } else if (typeof env.data === "string") {
      let bytes = unb64(env.data);
      if (env.enc) {
        const key = await keyFrom(password, unb64(env.enc.salt));
        bytes = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.enc.iv) as BufferSource }, key, bytes as BufferSource),
        );
      }
      if (env.gz) {
        if (!canGzip) throw new Error("이 브라우저는 압축 파일을 읽지 못합니다. 크롬·엣지 최신 버전을 사용해 주세요.");
        bytes = await pipe(bytes, new DecompressionStream("gzip"));
      }
      data = JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("이 브라우저")) throw e;
    throw new Error(env.enc ? "비밀번호가 맞지 않거나 파일이 손상되었습니다." : "저장 파일의 내용을 읽을 수 없습니다.");
  }
  if (!data || !Array.isArray(data.reports) || !data.naesin || !Array.isArray(data.naesin.students)) {
    throw new Error("저장 파일의 내용을 읽을 수 없습니다.");
  }
  return {
    reports: data.reports,
    naesin: { students: data.naesin.students, fileName: data.naesin.fileName ?? "" },
    files: Array.isArray(data.files) ? data.files : [],
    notes: data.notes && typeof data.notes === "object" ? data.notes : {},
    admission: data.admission,
    guidelines: Array.isArray(data.guidelines) ? data.guidelines : undefined,
  };
}
