import Link from "next/link";
import { ArrowRight, ExternalLink, ShieldAlert } from "lucide-react";
import {
  guideApps,
  guideIntro,
  guideNoticePersonal,
  guideShortcuts,
  guideTitle,
} from "@/config/guide";
import { PrintButton } from "@/features/guide/components/PrintButton";

// 요약본: "어떤 앱이 있고 무엇을 하는지"를 한 번에. 인쇄하면 A4 한두 장입니다.
export default function GuideSummaryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{guideTitle} · 요약본</h1>
          <p className="mt-2 text-stone-700">{guideIntro}</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          <b>꼭 알아 두세요.</b> {guideNoticePersonal}
        </p>
      </div>

      <section aria-labelledby="shortcut-title" className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 id="shortcut-title" className="text-xl font-bold mb-3">
          자주 하는 일 바로가기
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-stone-100 text-stone-800">
                <th className="text-left p-2 border border-stone-200">이럴 때</th>
                <th className="text-left p-2 border border-stone-200">여기로</th>
              </tr>
            </thead>
            <tbody>
              {guideShortcuts.map((s) => (
                <tr key={`${s.slug}-${s.when}`}>
                  <td className="p-2 border border-stone-200 text-stone-900">{s.when}</td>
                  <td className="p-2 border border-stone-200">
                    <Link href={`/guide/${s.slug}`} className="text-amber-800 font-medium hover:underline">
                      {s.where}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="apps-title">
        <h2 id="apps-title" className="text-xl font-bold mb-3">
          앱별 한눈에 보기
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {guideApps.map((app) => (
            <article key={app.slug} className="rounded-2xl border border-stone-200 bg-white p-5 break-inside-avoid">
              <h3 className="text-lg font-bold text-stone-900">{app.title}</h3>
              <p className="mt-1 text-sm text-stone-600">쓰는 사람: {app.who}</p>
              <p className="mt-2 text-stone-800">{app.summary}</p>
              <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-stone-800">
                {app.quick.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-3 flex-wrap print:hidden">
                <Link
                  href={`/guide/${app.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-amber-800 hover:underline"
                >
                  {app.detail ? "자세히 보기" : "자세한 설명 (준비 중)"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {app.href && (
                  <Link
                    href={app.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
                  >
                    앱 열기
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
