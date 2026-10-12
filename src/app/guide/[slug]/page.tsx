import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { getGuideApp, guideApps, guideTitle } from "@/config/guide";

// 상세 설명서: 앱 하나당 한 페이지. 내용은 src/config/guide.ts 한 곳에서 옵니다.
export function generateStaticParams() {
  return guideApps.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = getGuideApp(slug);
  return { title: app ? `${app.title} | ${guideTitle}` : guideTitle };
}

const TOC: { id: string; label: string }[] = [
  { id: "intro", label: "이 앱으로 무엇을 하나요" },
  { id: "prepare", label: "시작 전에 준비할 것" },
  { id: "steps", label: "단계별 따라하기" },
  { id: "more", label: "다른 기능" },
  { id: "faq", label: "자주 막히는 곳" },
  { id: "notes", label: "알아 두세요" },
];

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getGuideApp(slug);
  if (!app) notFound();

  const d = app.detail;
  const toc = TOC.filter((t) => t.id !== "more" || (d?.more && d.more.length > 0));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/guide"
          className="print:hidden inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          요약본으로
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">{app.title}</h1>
        <p className="mt-2 text-stone-700">쓰는 사람: {app.who}</p>
        {app.href && (
          <Link
            href={app.href}
            className="print:hidden mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-colors"
          >
            이 앱 열기
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>

      {!d ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-3">
          <p className="text-stone-900">{app.summary}</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-stone-800">
            {app.quick.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-stone-800">
            <b>자세한 설명은 준비 중입니다.</b> 위의 요약만 먼저 보시고, 쓰다가 막히면 관리자에게 물어보세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr] items-start">
          <nav
            aria-label="이 페이지 목차"
            className="print:hidden rounded-2xl border border-stone-200 bg-white p-3 text-sm lg:sticky lg:top-4"
          >
            <ul className="space-y-1">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded-lg px-2 py-1.5 text-stone-800 hover:bg-amber-50">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6 min-w-0">
            <section id="intro" className="rounded-2xl border border-stone-200 bg-white p-5 scroll-mt-4">
              <h2 className="text-xl font-bold mb-2">이 앱으로 무엇을 하나요</h2>
              <p className="text-stone-800">{d.intro}</p>
            </section>

            <section id="prepare" className="rounded-2xl border border-stone-200 bg-white p-5 scroll-mt-4">
              <h2 className="text-xl font-bold mb-2">시작 전에 준비할 것</h2>
              <ul className="list-disc pl-5 space-y-1 text-stone-800">
                {d.prepare.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            <section id="steps" className="rounded-2xl border border-stone-200 bg-white p-5 scroll-mt-4">
              <h2 className="text-xl font-bold mb-3">단계별 따라하기</h2>
              <ol className="space-y-4">
                {d.steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="shrink-0 w-7 h-7 rounded-full bg-amber-700 text-white text-sm font-bold flex items-center justify-center"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-900">{s.title}</h3>
                      <p className="mt-1 text-stone-800">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {d.more && d.more.length > 0 && (
              <section id="more" className="rounded-2xl border border-stone-200 bg-white p-5 scroll-mt-4">
                <h2 className="text-xl font-bold mb-3">다른 기능</h2>
                <div className="space-y-4">
                  {d.more.map((m) => (
                    <div key={m.title}>
                      <h3 className="font-bold text-stone-900">{m.title}</h3>
                      <p className="mt-1 text-stone-800">{m.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section id="faq" className="rounded-2xl border border-stone-200 bg-white p-5 scroll-mt-4">
              <h2 className="text-xl font-bold mb-3">자주 막히는 곳</h2>
              <dl className="space-y-4">
                {d.faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-bold text-stone-900">Q. {f.q}</dt>
                    <dd className="mt-1 text-stone-800">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="notes" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 scroll-mt-4">
              <h2 className="text-xl font-bold mb-2">알아 두세요</h2>
              <ul className="list-disc pl-5 space-y-1 text-stone-800">
                {d.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-stone-600">이 설명은 {d.checkedAt}에 실제 화면과 맞춰 확인했습니다.</p>
          </div>
        </div>
      )}

      <div className="print:hidden pt-2">
        <Link href="/guide" className="inline-flex items-center gap-1 text-sm font-bold text-amber-800 hover:underline">
          다른 앱 설명 보기
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
