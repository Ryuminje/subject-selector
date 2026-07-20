"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { School, KeyRound, ArrowLeft, Copy, Check } from "lucide-react";

type Mode = "create" | "join";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ schoolName: string; joinCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = mode === "create" ? "/api/schedule-helper/schools" : "/api/schedule-helper/join";
    const payload =
      mode === "create"
        ? { schoolName, adminName: name, email, password }
        : { joinCode, name, email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "처리 중 오류가 발생했습니다.");
      return;
    }

    if (mode === "create") {
      setCreated({ schoolName: body.schoolName, joinCode: body.joinCode });
    } else {
      router.push("/apps/schedule-helper");
    }
  };

  const copyJoinCode = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (created) {
    return (
      <div className="min-h-screen bg-teal-50 text-slate-800 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">{created.schoolName} 개설 완료</h1>
            <p className="text-sm text-slate-500 mb-6">
              아래 코드를 다른 선생님들께 공유해 주세요. 이 코드로 누구나 가입할 수 있습니다.
            </p>

            <div className="flex items-center justify-center gap-2 bg-teal-50 border border-teal-200 rounded-2xl py-4 mb-6">
              <span className="text-2xl font-mono font-bold tracking-widest text-teal-700">{created.joinCode}</span>
              <button
                onClick={copyJoinCode}
                className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
                title="복사"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => router.push("/apps/schedule-helper")}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors"
            >
              계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-teal-50 text-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 mb-6 text-sm text-teal-700 hover:text-teal-800 font-medium">
          <ArrowLeft className="w-4 h-4" />
          허브로 돌아가기
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === "create" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              }`}
            >
              <School className="w-4 h-4" />
              학교 만들기
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === "join" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              코드로 가입
            </button>
          </div>

          <p className="text-sm text-slate-500 mb-6">
            {mode === "create"
              ? "우리 학교를 새로 등록하고 관리자 계정을 만듭니다."
              : "동료 선생님께 받은 학교 코드로 가입합니다."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "create" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">학교 이름</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="예: 명신고등학교"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">학교 코드</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="8자리 코드"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {mode === "create" ? "관리자 이름" : "이름"}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />
            </div>
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
                minLength={8}
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
              {loading ? "처리 중..." : mode === "create" ? "학교 개설하기" : "가입하기"}
            </button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            이미 계정이 있으신가요?{" "}
            <Link href="/apps/schedule-helper/login" className="text-teal-700 font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
