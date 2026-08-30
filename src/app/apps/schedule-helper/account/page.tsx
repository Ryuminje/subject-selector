"use client";

import { useState } from "react";
import Link from "next/link";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";
import { ArrowLeft, KeyRound } from "lucide-react";
import { changePassword } from "@/lib/auth-client";

// login/page.tsx와 같은 이유로 여기도 전용 layout.tsx가 없어 폰트를 직접 불러옵니다.
// 세 앱(교체 도우미/이수증 수거/AI 파트너) 전부에서 링크로 들어오는 공용 화면이라
// 특정 앱 색이 아니라 로그인·가입 화면과 같은 swap 톤을 기본값으로 씁니다.
const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setLoading(true);
    const { error: changeError } = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (changeError) {
      setError(changeError.message ?? "비밀번호 변경에 실패했습니다.");
      return;
    }
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
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
            <KeyRound className="w-5 h-5 text-swap" />
            비밀번호 변경
          </h1>
          <p className="text-sm text-[#8B8577] mb-6">현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#5B564C] mb-1.5">현재 비밀번호</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5B564C] mb-1.5">새 비밀번호</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#FBF9F4] border border-[#E2DCCC] rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-swap/40 focus:border-swap transition-all"
              />
            </div>

            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-[10px] px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-[10px] px-3 py-2">
                비밀번호가 변경되었습니다.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-swap hover:opacity-90 disabled:opacity-60 text-white font-semibold rounded-[10px] transition-opacity"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
