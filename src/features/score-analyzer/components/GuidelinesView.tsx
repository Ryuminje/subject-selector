"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { guidelineKey, parseGuidelines, type Guideline } from "../lib/guideline";

export interface GuidelineMeta {
  count: number;
  updatedAt: string | null;
}

interface Props {
  /** 화면에 적용 중인 모집요강 전체(서버 자료 + 저장 파일에서 불러온 것) */
  guidelines: Guideline[];
  /** 서버(DB)에서 받아온 모집요강의 키 */
  serverKeys: Set<string>;
  meta: GuidelineMeta | null;
  state: "loading" | "ok" | "error";
  /** 서버에서 다시 받아옵니다(올린 직후, 또는 '다시 확인' 버튼) */
  onReload: () => Promise<void>;
}

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function GuidelinesView({ guidelines, serverKeys, meta, state, onReload }: Props) {
  // 모집요강을 올리는 칸은 관리자 계정에만 보입니다(서버도 관리자만 받습니다).
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | "수시" | "정시">("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const univCount = useMemo(() => new Set(guidelines.map((g) => g.source.shortName)).size, [guidelines]);
  const shown = useMemo(() => {
    const k = q.trim();
    return guidelines
      .filter((g) => (!kind || g.source.kind === kind) && (!k || g.source.shortName.includes(k) || g.source.university?.includes?.(k)))
      .sort((a, b) => a.source.shortName.localeCompare(b.source.shortName, "ko") || a.source.kind.localeCompare(b.source.kind, "ko"));
  }, [guidelines, q, kind]);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setMsg(null);
    const incoming: Guideline[] = [];
    try {
      for (const file of [...list]) {
        if (!/\.json$/i.test(file.name)) throw new Error(`"${file.name}" 은(는) JSON 파일이 아닙니다.`);
        setBusy(`"${file.name}" 읽는 중…`);
        incoming.push(...parseGuidelines(await file.text()));
      }
      if (!window.confirm(`모집요강 ${incoming.length}건을 서버에 저장합니다. 같은 대학·구분·학년도는 덮어쓰며, 모든 교사 화면에 보이게 됩니다. 계속할까요?`)) {
        setBusy("");
        return;
      }
      setBusy("서버에 저장하는 중…");
      const r = await fetch("/api/admission-guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelines: incoming }),
      });
      const d = (await r.json().catch(() => ({}))) as { saved?: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? "저장하지 못했습니다.");
      await onReload();
      setMsg({ ok: true, text: `서버에 ${d.saved}건 저장했습니다. 아래 목록과 위쪽 건수가 바뀌었는지 확인하세요.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." });
    }
    setBusy("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="max-w-[2200px] mx-auto px-4 py-3 grid gap-3">
      <section className="rounded-2xl border border-stone-200 bg-white p-4" aria-live="polite">
        <h2 className="font-bold mb-2">서버에 올라간 모집요강</h2>
        {state === "loading" && <p className="text-sm text-stone-700">서버에서 확인하는 중…</p>}
        {state === "error" && (
          <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
            서버에서 모집요강을 불러오지 못했습니다. 잠시 뒤 &lsquo;다시 확인&rsquo;을 눌러 보세요.
          </p>
        )}
        {state === "ok" && meta && meta.count > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <b>{meta.count.toLocaleString()}건</b> 올라와 있습니다 · 대학 {univCount}곳 · 마지막 갱신 {fmtTime(meta.updatedAt)}
            </span>
          </p>
        )}
        {state === "ok" && meta && meta.count === 0 && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            아직 서버에 올라온 모집요강이 없습니다. 관리자가 올리면 이곳에 나타납니다.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void onReload()}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-stone-50"
          >
            다시 확인
          </button>
          <span className="text-xs text-stone-600">
            이 자료는 PDF를 AI가 정리한 것이라 대부분 &lsquo;미확인&rsquo;입니다. 원문과 대조한 뒤 쓰세요.
          </span>
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-bold mb-2">모집요강 올리기 (관리자 전용)</h2>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files);
            }}
            className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-amber-400 bg-white px-3 py-6 text-center cursor-pointer hover:bg-amber-100"
          >
            <CloudUpload className="w-6 h-6 text-amber-700" />
            <span className="text-sm font-bold">{busy || "모집요강 정리 파일(.json)을 끌어다 놓거나 눌러서 고르세요"}</span>
            <span className="text-xs text-stone-600">여러 대학이 든 통합 파일(모집요강_통합.json)도 한 번에 올릴 수 있습니다</span>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              multiple
              disabled={!!busy}
              className="sr-only"
              onChange={(e) => void upload(e.target.files)}
            />
          </label>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-700">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
            올리면 서버(DB)에 저장되어 모든 교사에게 보입니다. 학생 정보는 들어 있지 않은 공개 모집요강 자료만 올리세요.
          </p>
          {msg && (
            <p
              className={`mt-2 rounded-lg border px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}
              role="status"
            >
              {msg.text}
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="font-bold mr-2">목록 {shown.length.toLocaleString()}건</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="대학 이름 검색"
            aria-label="대학 이름 검색"
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm"
          />
          {(["", "수시", "정시"] as const).map((k) => (
            <button
              key={k || "all"}
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${kind === k ? "bg-stone-800 text-white border-stone-800" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"}`}
            >
              {k || "전체"}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-stone-600">조건에 맞는 모집요강이 없습니다.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {shown.map((g) => (
              <li key={guidelineKey(g)} className="flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-1.5 text-xs">
                <FileText className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
                <span className="flex-1 min-w-0">
                  <b className="block truncate">
                    {g.source.shortName}
                    {g.source.campus ? `(${g.source.campus})` : ""} · {g.source.kind} · {g.source.admissionYear}학년도
                  </b>
                  <span className={g.review.status === "확인됨" ? "text-emerald-700" : "text-amber-700"}>{g.review.status}</span>
                  {g.engine?.gyogwa?.length ? " · 교과 계산 규칙 있음" : ""}
                  {!serverKeys.has(guidelineKey(g)) && <span className="text-stone-600"> · 저장 파일에서 불러옴(서버에 없음)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
