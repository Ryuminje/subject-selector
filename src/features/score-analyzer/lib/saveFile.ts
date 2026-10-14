// 성적·상담 메모를 파일 하나로 저장/불러오기. 모두 이 컴퓨터 안에서만 처리하며 서버로 보내지 않습니다.
// 비밀번호를 주면 브라우저 내장 암호화(AES-GCM)로 파일을 잠급니다.

import type { NeisStudent } from "./neis";
import type { Report } from "./types";

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
}

interface Envelope {
  app: "score-analyzer";
  v: 1;
  data?: SaveData;
  enc?: { salt: string; iv: string; data: string };
}

const b64 = (u: Uint8Array) => {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

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
  let env: Envelope = { app: "score-analyzer", v: 1, data };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(password, salt);
    const plain = new TextEncoder().encode(JSON.stringify(data));
    const buf = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    env = { app: "score-analyzer", v: 1, enc: { salt: b64(salt), iv: b64(iv), data: b64(buf) } };
  }
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
  let data: SaveData | undefined = env.data;
  if (env.enc) {
    try {
      const key = await keyFrom(password, unb64(env.enc.salt));
      const buf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(env.enc.iv) as BufferSource },
        key,
        unb64(env.enc.data) as BufferSource,
      );
      data = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      throw new Error("비밀번호가 맞지 않거나 파일이 손상되었습니다.");
    }
  }
  if (!data || !Array.isArray(data.reports) || !data.naesin || !Array.isArray(data.naesin.students)) {
    throw new Error("저장 파일의 내용을 읽을 수 없습니다.");
  }
  return {
    reports: data.reports,
    naesin: { students: data.naesin.students, fileName: data.naesin.fileName ?? "" },
    files: Array.isArray(data.files) ? data.files : [],
    notes: data.notes && typeof data.notes === "object" ? data.notes : {},
  };
}
