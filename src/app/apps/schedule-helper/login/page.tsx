"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ArrowLeft } from "lucide-react";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "로그인에 실패했습니다.");
      return;
    }
    router.push("/apps/schedule-helper");
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
          <p className="text-sm text-slate-500 mb-6">시간표 교체 도우미에 로그인합니다.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
