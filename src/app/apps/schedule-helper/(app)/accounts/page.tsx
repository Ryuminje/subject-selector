"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession } from "@/lib/auth-client";
import {
  ArrowLeft,
  UserPlus,
  ShieldAlert,
  Loader2,
  KeyRound,
  Copy,
  Check,
  Upload,
  RotateCcw,
  Users,
  Trash2,
} from "lucide-react";

interface AccountRow {
  id: string;
  name: string;
  loginId: string;
  createdAt: string;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  loginId: string | null;
  role: string;
  createdAt: string;
}

interface BulkResultRow {
  name: string;
  loginId: string;
}

interface BulkSkippedRow extends BulkResultRow {
  reason: string;
}

export default function AccountsPage() {
  const { data: schedule } = useSchedule();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [copied, setCopied] = useState(false);

  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberDeletingId, setMemberDeletingId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ created: BulkResultRow[]; skipped: BulkSkippedRow[] } | null>(null);

  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadAccounts = () => {
    setLoadingAccounts(true);
    fetch("/api/schedule-helper/teachers/accounts")
      .then((res) => res.json())
      .then((body) => setAccounts(body.accounts ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false));
  };

  const loadMembers = () => {
    setLoadingMembers(true);
    fetch("/api/schedule-helper/members")
      .then((res) => res.json())
      .then((body) => setMembers(body.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  };

  // 최초 진입 시 계정 목록을 불러옴 (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지,
  // loadAccounts/loadMembers는 setLoading...(true)를 동기 호출하므로 여기서 그대로 재사용하지 않고 fetch 체인을 별도로 둠)
  useEffect(() => {
    fetch("/api/schedule-helper/teachers/accounts")
      .then((res) => res.json())
      .then((body) => setAccounts(body.accounts ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false));
    fetch("/api/schedule-helper/members")
      .then((res) => res.json())
      .then((body) => setMembers(body.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  const handleCopyJoinCode = async () => {
    if (!schedule?.joinCode) return;
    await navigator.clipboard.writeText(schedule.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    const res = await fetch("/api/schedule-helper/teachers/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), loginId: loginId.trim(), password }),
    });
    const body = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      setCreateError(body.error ?? "계정 생성 중 오류가 발생했습니다.");
      return;
    }
    setName("");
    setLoginId("");
    setPassword("");
    loadAccounts();
    loadMembers();
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkError(null);
    setBulkResult(null);
    setBulkUploading(true);
    const formData = new FormData();
    formData.append("file", bulkFile);
    formData.append("password", bulkPassword);
    const res = await fetch("/api/schedule-helper/teachers/accounts/bulk", {
      method: "POST",
      body: formData,
    });
    const body = await res.json().catch(() => ({}));
    setBulkUploading(false);
    if (!res.ok) {
      setBulkError(body.error ?? "일괄 생성 중 오류가 발생했습니다.");
      return;
    }
    setBulkResult({ created: body.created ?? [], skipped: body.skipped ?? [] });
    setBulkFile(null);
    loadAccounts();
    loadMembers();
  };

  const handleDeleteMember = async (member: MemberRow) => {
    if (!window.confirm(`"${member.name}" 님의 계정을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setMemberError(null);
    setMemberDeletingId(member.id);
    const res = await fetch(`/api/schedule-helper/members/${member.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setMemberDeletingId(null);
    if (!res.ok) {
      setMemberError(body.error ?? "삭제 중 오류가 발생했습니다.");
      return;
    }
    loadMembers();
    loadAccounts();
  };

  const handleResetPassword = async (id: string) => {
    if (!resetPassword || resetPassword.length < 8) {
      setResetError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setResetError(null);
    setResetting(true);
    const res = await fetch(`/api/schedule-helper/teachers/accounts/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setResetting(false);
    if (!res.ok) {
      setResetError(body.error ?? "비밀번호 재설정 중 오류가 발생했습니다.");
      return;
    }
    setResetTargetId(null);
    setResetPassword("");
  };

  if (!isAdmin) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-semibold text-slate-600">관리자만 접근할 수 있는 페이지입니다.</p>
        <Link href="/apps/schedule-helper" className="inline-block mt-6 text-teal-700 font-semibold hover:underline">
          돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-2 md:px-6 py-6 w-full">
      <Link
        href="/apps/schedule-helper"
        className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        수업교체 도우미로 돌아가기
      </Link>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 md:p-8 rounded-3xl shadow-lg text-white mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <KeyRound className="w-7 h-7" /> 계정 관리
        </h1>
        <p className="text-emerald-50 font-medium text-sm md:text-base">
          이메일 없이 아이디 + 비밀번호로 로그인할 계정을 직접 만들거나 엑셀로 한 번에 등록합니다.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <Users className="w-5 h-5" /> 전체 가입 인원
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          이메일 셀프가입·아이디 발급 계정을 모두 포함한, 이 학교에 가입된 전체 인원입니다.
        </p>
        {memberError && <p className="text-sm text-rose-600 mb-3">{memberError}</p>}
        {loadingMembers ? (
          <div className="flex justify-center py-8 text-teal-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !members?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">가입된 인원이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const isSelf = m.id === session?.user?.id;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{m.name}</span>
                      {isSelf && <span className="text-xs text-slate-400">(나)</span>}
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          m.role === "ADMIN" ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {m.role === "ADMIN" ? "관리자" : "교사"}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                        {m.loginId ? "아이디 로그인" : "이메일"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{m.loginId ?? m.email}</p>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => handleDeleteMember(m)}
                      disabled={memberDeletingId === m.id}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {memberDeletingId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      삭제
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1">학교 코드</h2>
        <p className="text-sm text-slate-500 mb-4">
          아이디 로그인은 화면에서 학교를 검색해서 선택하므로 이 코드가 필요 없습니다. 이 코드는 선생님이
          이메일로 직접 &quot;코드로 가입&quot;할 때만 필요합니다.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tracking-[0.2em] text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-5 py-2.5">
            {schedule?.joinCode ?? "-"}
          </span>
          <button
            onClick={handleCopyJoinCode}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> 계정 하나 만들기
        </h2>
        <p className="text-sm text-slate-500 mb-4">아이디는 한글/영문/숫자/._- 를 사용해 2~30자로 입력하세요.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="아이디"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="초기 비밀번호"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
        </div>
        {createError && <p className="text-sm text-rose-600 mb-3">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !loginId.trim() || !password}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          계정 만들기
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5" /> 엑셀로 한 번에 등록하기
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          엑셀 파일 A열=이름, B열=아이디 (1행은 머리글로 간주해 건너뜁니다). 아래 초기 비밀번호가 모든 계정에
          동일하게 적용됩니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
          />
          <input
            type="text"
            value={bulkPassword}
            onChange={(e) => setBulkPassword(e.target.value)}
            placeholder="전체 적용할 초기 비밀번호"
            className="sm:w-56 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
          <button
            onClick={handleBulkUpload}
            disabled={bulkUploading || !bulkFile || !bulkPassword}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            {bulkUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            업로드
          </button>
        </div>
        {bulkError && <p className="text-sm text-rose-600 mb-3">{bulkError}</p>}
        {bulkResult && (
          <div className="mt-3 space-y-3">
            <div className="text-sm font-semibold text-emerald-700">
              생성됨 {bulkResult.created.length}건
              {bulkResult.created.length > 0 && (
                <span className="font-normal text-slate-500">
                  {" "}
                  — {bulkResult.created.map((r) => `${r.name}(${r.loginId})`).join(", ")}
                </span>
              )}
            </div>
            {bulkResult.skipped.length > 0 && (
              <div className="text-sm">
                <div className="font-semibold text-rose-600 mb-1">건너뜀 {bulkResult.skipped.length}건</div>
                <ul className="space-y-1 text-slate-600">
                  {bulkResult.skipped.map((r, i) => (
                    <li key={i} className="text-xs">
                      {r.name || "(이름 없음)"}({r.loginId || "(아이디 없음)"}) — {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-4">아이디 로그인 계정 목록</h2>
        {loadingAccounts ? (
          <div className="flex justify-center py-8 text-teal-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !accounts?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">아직 만든 아이디 계정이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">{a.name}</span>{" "}
                    <span className="text-sm text-slate-500">· {a.loginId}</span>
                  </div>
                  <button
                    onClick={() => {
                      setResetTargetId(resetTargetId === a.id ? null : a.id);
                      setResetPassword("");
                      setResetError(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> 비밀번호 재설정
                  </button>
                </div>
                {resetTargetId === a.id && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="새 비밀번호 (8자 이상)"
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                    />
                    <button
                      onClick={() => handleResetPassword(a.id)}
                      disabled={resetting}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors shrink-0"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : "적용"}
                    </button>
                  </div>
                )}
                {resetTargetId === a.id && resetError && (
                  <p className="text-xs text-rose-600 mt-2">{resetError}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
