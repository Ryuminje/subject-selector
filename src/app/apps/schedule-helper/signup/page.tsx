"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";
import { School, KeyRound, ArrowLeft, Copy, Check } from "lucide-react";

// login/page.tsx와 같은 이유로 여기도 전용 layout.tsx가 없어 폰트를 직접 불러옵니다.
const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

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
      <div
        className={`${notoSansKR.className} ${songMyung.variable} min-h-screen bg-[#F1EEE6] text-[#221F1A] flex items-center justify-center px-4`}
      >
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-[14px] border border-[#E2DCCC] p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-7 h-7" />
            </div>
            <h1 className="font-display text-xl mb-1">{created.schoolName} 개설 완료</h1>
            <p className="text-sm text-[#8B8577] mb-6">
              아래 코드를 다른 선생님들께 공유해 주세요. 이 코드로 누구나 가입할 수 있습니다.
            </p>

            <div className="flex items-center justify-center gap-2 bg-swap/8 border border-swap/25 rounded-[10px] py-4 mb-6">
              <span className="text-2xl font-mono font-bold tracking-widest text-swap">{created.joinCode}</span>
              <button
                onClick={copyJoinCode}
                className="p-2 text-swap hover:bg-swap/15 rounded-lg transition-colors"
                title="복사"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => router.push("/apps/schedule-helper")}
              className="w-full py-3 bg-swap hover:opacity-90 text-white font-semibold rounded-[10px] transition-opacity"
            >
              계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex gap-2 mb-6 bg-[#F1EEE6] p-1 rounded-[10px]">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-semibold transition-colors ${
                mode === "create" ? "bg-white text-swap shadow-sm" : "text-[#8B8577]"
              }`}
            >
              <School className="w-4 h-4" />
              학교 만들기
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-semibold transition-colors ${
                mode === "join" ? "bg-white text-swap shadow-sm" : "text-[#8B8577]"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              코드로 가입
            </button>
          </div>

          <p className="text-sm text-[#8B8577] mb-6">
            {mode === "create"
              ? "우리 학교를 새로 등록하고 관리자 계정을 만듭니다."
              : "동료 선생님께 받은 학교 코드로 가입합니다."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "create" ? (
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">학교 이름</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="예: 명신고등학교"
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[#5B564C] mb-1.5">학교 코드</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="8자리 코드"
                  className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#5B564C] mb-1.5">
                {mode === "create" ? "관리자 이름" : "이름"}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
              />
            </div>
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
                minLength={8}
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
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-swap hover:opacity-90 disabled:opacity-60 text-white font-semibold rounded-[10px] transition-opacity"
            >
              {loading ? "처리 중..." : mode === "create" ? "학교 개설하기" : "가입하기"}
            </button>
          </form>

          <p className="text-sm text-[#8B8577] mt-6 text-center">
            이미 계정이 있으신가요?{" "}
            <Link href="/apps/schedule-helper/login" className="text-swap font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
