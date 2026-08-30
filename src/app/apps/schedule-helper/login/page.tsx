"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";
import { LogIn, ArrowLeft, ShieldCheck, KeyRound, School, ChevronDown } from "lucide-react";
import { signIn } from "@/lib/auth-client";

// 이 라우트는 전용 layout.tsx가 없어서(가입 화면과 함께 최상위 RootLayout의 Geist를
// 그대로 물려받고 있었습니다), 다른 쌤스 헬퍼 화면과 폰트가 어긋나 있었습니다.
// 2026-08-30 디자인 개편으로 나머지 화면과 같은 조합을 여기서 직접 불러옵니다.
const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

type Mode = "email" | "id";

interface SchoolOption {
  id: string;
  name: string;
}

// 오픈 리다이렉트 방지: schedule-helper 내부 경로로만 리다이렉트
function resolveNextPath(next: string | null): string {
  if (next && next.startsWith("/apps/schedule-helper")) return next;
  return "/apps/schedule-helper";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = resolveNextPath(searchParams.get("next"));
  const [mode, setMode] = useState<Mode>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolResults, setSchoolResults] = useState<SchoolOption[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const schoolBoxRef = useRef<HTMLDivElement>(null);
  const [loginId, setLoginId] = useState("");
  const [idPassword, setIdPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolOpen) return;
    const timer = setTimeout(() => {
      setSchoolLoading(true);
      fetch(`/api/schedule-helper/schools/search?q=${encodeURIComponent(schoolQuery.trim())}`)
        .then((res) => res.json())
        .then((body) => setSchoolResults(body.schools ?? []))
        .catch(() => setSchoolResults([]))
        .finally(() => setSchoolLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [schoolQuery, schoolOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schoolBoxRef.current && !schoolBoxRef.current.contains(e.target as Node)) {
        setSchoolOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // e를 선택값으로 둔 이유: <form onSubmit>(Enter로 제출할 때)과 <button type="button" onClick>
  // (버튼 클릭) 양쪽에서 같은 함수를 씁니다. 자세한 이유는 아래 <form method="post"> 주석 참고.
  const handleSubmitEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "로그인에 실패했습니다.");
      return;
    }
    router.push(nextPath);
  };

  const handleSubmitId = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedSchool) {
      setError("학교를 선택해 주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/schedule-helper/login-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: selectedSchool.id, loginId, password: idPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "로그인에 실패했습니다.");
      return;
    }
    router.push(nextPath);
  };

  return (
    <div
      className={`${notoSansKR.className} ${songMyung.variable} min-h-screen bg-[#F1EEE6] text-[#221F1A] flex items-center justify-center px-4`}
    >
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 mb-6 text-sm text-swap hover:opacity-80 font-medium">
          <ArrowLeft className="w-4 h-4" />
          허브로 돌아가기
        </Link>

        <div className="bg-white rounded-[14px] border border-[#E2DCCC] p-8">
          <h1 className="font-display text-xl flex items-center gap-2 mb-1">
            <LogIn className="w-5 h-5 text-swap" />
            쌤스 헬퍼 로그인
          </h1>
          <p className="text-sm text-[#8B8577] mb-6">
            {nextPath.startsWith("/apps/schedule-helper/certificates")
              ? "연수 이수증 수거에 로그인합니다."
              : "시간표 교체 도우미에 로그인합니다."}
          </p>

          <div className="flex gap-2 mb-6 bg-[#F1EEE6] p-1 rounded-[10px]">
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-semibold transition-colors ${
                mode === "email" ? "bg-white text-swap shadow-sm" : "text-[#8B8577]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              관리자 로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("id");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-semibold transition-colors ${
                mode === "id" ? "bg-white text-swap shadow-sm" : "text-[#8B8577]"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              아이디로 로그인
            </button>
          </div>

          {mode === "email" ? (
            // ⚠️ action 없는 <form onSubmit>은 리액트가 하이드레이션(이벤트를 붙이는 과정)을
            // 끝내기 전까지 아무 방어가 없습니다 — 그 사이 로그인 버튼을 누르면 브라우저가
            // "현재 URL로 GET 제출"이라는 기본 동작을 그대로 실행해서, 이메일·비밀번호가 그대로
            // URL 쿼리스트링에 실려 새로고침됩니다(브라우저 히스토리·Vercel 요청 로그에 평문으로
            // 남음). 처음 접속하는 컴퓨터는 자바스크립트 번들을 새로 받느라 하이드레이션이 느려서
            // 이 틈에 누른 클릭이 전부 여기로 샜습니다(실제로 겪은 버그 — "로그인이 안 되다가
            // 여러 번 누르거나 새로고침하면 어쩌다 성공"). 아래 버튼을 type="button"으로 두면
            // 하이드레이션 전 클릭은 그냥 아무 일도 안 일어나(안전), 완전히 사라지진 않는
            // "Enter 키" 경로만 method="post"로 최소한 URL 노출은 막습니다.
            <form onSubmit={handleSubmitEmail} method="post" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">이메일</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">비밀번호</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-[10px] px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSubmitEmail()}
                disabled={loading}
                className="w-full py-3 bg-swap hover:opacity-90 disabled:opacity-60 text-white font-semibold rounded-[10px] transition-opacity"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          ) : (
            // 이메일 폼과 같은 이유로 method="post"를 둡니다 — 자세한 설명은 위 주석 참고.
            // 이 폼은 아이디 로그인이라 학교 계정 비밀번호가 걸려 있어 특히 새 줄 필요.
            <form onSubmit={handleSubmitId} method="post" className="space-y-4">
              <div ref={schoolBoxRef} className="relative">
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">학교</label>
                {selectedSchool ? (
                  <div className="w-full flex items-center justify-between px-3 py-2.5 bg-swap/10 border border-swap/25 rounded-[10px] text-sm">
                    <span className="font-semibold text-swap flex items-center gap-1.5">
                      <School className="w-4 h-4" />
                      {selectedSchool.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSchool(null);
                        setSchoolQuery("");
                        setSchoolOpen(true);
                      }}
                      className="text-xs font-semibold text-swap hover:underline"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSchoolOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all text-left"
                  >
                    <span className="text-[#8B8577]">학교를 검색하세요</span>
                    <ChevronDown className={`w-4 h-4 text-[#8B8577] transition-transform shrink-0 ${schoolOpen ? "rotate-180" : ""}`} />
                  </button>
                )}

                {schoolOpen && !selectedSchool && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white border border-[#E2DCCC] rounded-[10px] shadow-lg overflow-hidden">
                    <input
                      type="text"
                      autoFocus
                      value={schoolQuery}
                      onChange={(e) => setSchoolQuery(e.target.value)}
                      placeholder="학교 이름 검색"
                      className="w-full px-4 py-2.5 border-b border-[#EBE6D9] text-sm focus:outline-none"
                    />
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#EBE6D9]">
                      {schoolLoading ? (
                        <div className="px-4 py-3 text-sm text-[#8B8577]">검색 중...</div>
                      ) : schoolResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[#8B8577]">일치하는 학교가 없습니다.</div>
                      ) : (
                        schoolResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSchool(s);
                              setSchoolOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#5B564C] hover:bg-swap/8 hover:text-swap transition-colors"
                          >
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">아이디</label>
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">비밀번호</label>
                <input
                  type="password"
                  required
                  value={idPassword}
                  onChange={(e) => setIdPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-[10px] px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSubmitId()}
                disabled={loading}
                className="w-full py-3 bg-swap hover:opacity-90 disabled:opacity-60 text-white font-semibold rounded-[10px] transition-opacity"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          )}

          <p className="text-sm text-[#8B8577] mt-6 text-center">
            아직 계정이 없으신가요?{" "}
            <Link href="/apps/schedule-helper/signup" className="text-swap font-semibold hover:underline">
              가입하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
