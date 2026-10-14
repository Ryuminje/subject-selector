// 대학어디가 입결 자료(엑셀 '대학자료' 시트)를 브라우저에서 읽어 필요한 열만 남기고 줄입니다.
// 줄인 자료는 저장 파일에 함께 담깁니다. 서버로 보내지 않습니다.

import * as XLSX from "xlsx-js-style";

export type AdmKind = "susi" | "jeongsi";

export interface AdmRow {
  kind: AdmKind;
  region: string;
  univ: string;
  year: number | null;
  track: string;
  dept: string;
  /** 인문/자연/예체능/의학 등 */
  field: string;
  /** 소계열(수시 파일에만 있음) */
  sub: string;
  /** 교과/종합/논술(수시) */
  type: string;
  quota: number | null;
  rate: number | null;
  /** 추가합격(충원) 인원 */
  extra: number | null;
  /** 환산점수 50%/70% 컷, 만점 */
  c50: number | null;
  c70: number | null;
  full: number | null;
  /** 수시: 합격자 내신 등급 50%/70% 컷 */
  g50: number | null;
  g70: number | null;
  /** 정시: 백분위 평균 50%/70% 컷 */
  p50: number | null;
  p70: number | null;
  kor: number | null;
  math: number | null;
  inq: number | null;
  avg: number | null;
  /** 정시: 합격자 영어 등급 */
  eng: number | null;
  /** 실질 경쟁률 */
  real: number | null;
  /** 정시: 수학 선택 비율(확통·미적·기하) */
  rs: number | null;
  rc: number | null;
  rg: number | null;
}

const STR = ["region", "univ", "track", "dept", "field", "sub", "type"] as const;
const NUM = ["year", "quota", "rate", "extra", "c50", "c70", "full", "g50", "g70", "p50", "p70", "kor", "math", "inq", "avg", "eng", "real", "rs", "rc", "rg"] as const;

/** 엑셀 머리글 → 필드 */
const HEADER: Record<string, (typeof STR)[number] | (typeof NUM)[number]> = {
  지역: "region",
  대학: "univ",
  전형: "track",
  학과: "dept",
  "인문/자연": "field",
  소계열: "sub",
  "교과/종합": "type",
  연도: "year",
  모집인원: "quota",
  경쟁률: "rate",
  추합: "extra",
  변환50: "c50",
  변환70: "c70",
  만점: "full",
  등급50: "g50",
  등급70: "g70",
  평균50: "p50",
  평균70: "p70",
  국어: "kor",
  수학: "math",
  탐구: "inq",
  평균: "avg",
  영어: "eng",
  실경쟁률: "real",
  확통: "rs",
  미적: "rc",
  기하: "rg",
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  return null;
};
const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** '대학자료' 시트만 읽습니다(다른 시트는 건너뛰어 빠릅니다). 수시/정시는 '수시/정시' 열로 판단합니다. */
export async function readAdmissionXlsx(file: File): Promise<{ kind: AdmKind; rows: AdmRow[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", sheets: "대학자료", cellFormula: false, cellStyles: false, cellDates: false });
  const ws = wb.Sheets["대학자료"];
  if (!ws) throw new Error("'대학자료' 시트를 찾지 못했습니다. 대학어디가 입결자료 파일이 맞는지 확인해 주세요.");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const rows: AdmRow[] = [];
  let kind: AdmKind | null = null;
  for (const r of raw) {
    const k = str(r["수시/정시"]);
    if (k !== "수시" && k !== "정시") continue;
    kind ??= k === "수시" ? "susi" : "jeongsi";
    const row = { kind: k === "수시" ? "susi" : "jeongsi" } as AdmRow;
    for (const f of STR) row[f] = "";
    for (const f of NUM) row[f] = null;
    for (const [h, f] of Object.entries(HEADER)) {
      if (!(h in r)) continue;
      if ((STR as readonly string[]).includes(f)) (row as unknown as Record<string, string>)[f] = str(r[h]);
      else (row as unknown as Record<string, number | null>)[f] = num(r[h]);
    }
    if (!row.univ || !row.dept || row.year == null) continue;
    rows.push(row);
  }
  if (!kind || !rows.length) throw new Error("입결 자료 행을 찾지 못했습니다. '대학자료' 시트에 수시/정시 열이 있는지 확인해 주세요.");
  return { kind, rows };
}

// ---- 저장 파일용 압축 형태 ----

export interface AdmissionPack {
  v: 1;
  /** 문자열 사전 */
  strings: string[];
  tables: { susi?: (number | null)[][]; jeongsi?: (number | null)[][] };
  sources: { susi?: string; jeongsi?: string };
}

export interface AdmissionState {
  susi: AdmRow[];
  jeongsi: AdmRow[];
  /** 올린 파일 이름 */
  sources: { susi?: string; jeongsi?: string };
}

export const EMPTY_ADMISSION: AdmissionState = { susi: [], jeongsi: [], sources: {} };

export function packAdmission(a: AdmissionState): AdmissionPack | undefined {
  if (!a.susi.length && !a.jeongsi.length) return undefined;
  const strings: string[] = [];
  const index = new Map<string, number>();
  const sid = (s: string) => {
    let i = index.get(s);
    if (i == null) {
      i = strings.length;
      strings.push(s);
      index.set(s, i);
    }
    return i;
  };
  const pack = (rows: AdmRow[]) => rows.map((r) => [...STR.map((f) => sid(r[f])), ...NUM.map((f) => r[f])]);
  return {
    v: 1,
    strings,
    tables: { ...(a.susi.length ? { susi: pack(a.susi) } : {}), ...(a.jeongsi.length ? { jeongsi: pack(a.jeongsi) } : {}) },
    sources: a.sources,
  };
}

export function unpackAdmission(p: AdmissionPack | undefined): AdmissionState {
  if (!p || p.v !== 1) return EMPTY_ADMISSION;
  const unpack = (kind: AdmKind, t: (number | null)[][] | undefined): AdmRow[] =>
    (t ?? []).map((a) => {
      const row = { kind } as AdmRow;
      STR.forEach((f, i) => {
        row[f] = p.strings[a[i] as number] ?? "";
      });
      NUM.forEach((f, i) => {
        row[f] = a[STR.length + i] ?? null;
      });
      return row;
    });
  return { susi: unpack("susi", p.tables.susi), jeongsi: unpack("jeongsi", p.tables.jeongsi), sources: p.sources ?? {} };
}
