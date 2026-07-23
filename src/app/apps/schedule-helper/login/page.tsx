"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { signIn } from "@/lib/auth-client";

type Mode = "email" | "id";

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

  const [schoolJoinCode, setSchoolJoinCode] = useState("");
  const [loginId, setLoginId] = useState("");
  const [idPassword, setIdPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSubmitId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/schedule-helper/login-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolJoinCode, loginId, password: idPassword }),
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
    <div className="min-h-screen bg-teal-50 text-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 mb-6 text-sm text-teal-700 hover:text-teal-800 font-medium">
          <ArrowLeft className="w-4 h-4" />
          허브로 돌아가기
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-teal-700 flex items-center gap-2 mb-1">
            <LogIn className="w-5 h-5" />
            쌤스 헬퍼 로그인
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {nextPath.startsWith("/apps/schedule-helper/certificates")
              ? "연수 이수증 수거에 로그인합니다."
              : "시간표 교체 도우미에 로그인합니다."}
          </p>

          <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === "email" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              }`}
            >
              <Mail className="w-4 h-4" />
              이메일로 로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("id");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === "id" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              아이디로 로그인
            </button>
          </div>

          {mode === "email" ? (
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitId} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">학교 코드</label>
                <input
                  type="text"
                  required
                  value={schoolJoinCode}
                  onChange={(e) => setSchoolJoinCode(e.target.value.toUpperCase())}
                  placeholder="8자리 코드"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">아이디</label>
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
                <input
                  type="password"
                  required
                  value={idPassword}
                  onChange={(e) => setIdPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          )}

          <p className="text-sm text-slate-500 mt-6 text-center">
            아직 계정이 없으신가요?{" "}
            <Link href="/apps/schedule-helper/signup" className="text-teal-700 font-semibold hover:underline">
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
