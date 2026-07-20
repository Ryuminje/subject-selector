"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { schoolName, introText, departments } from "@/config/hub";

const palette = [
  {
    base: "bg-amber-100 border border-amber-200 hover:bg-amber-200",
    active: "bg-amber-600 border border-amber-600 shadow-lg shadow-amber-500/20",
    icon: "bg-white/70 text-amber-700",
    iconActive: "bg-white/20 text-white",
    title: "text-amber-900",
    titleActive: "text-white",
    subtitle: "text-amber-800/70",
    subtitleActive: "text-amber-50/90",
    count: "text-amber-700/70",
    countActive: "text-amber-50/80",
  },
  {
    base: "bg-rose-100 border border-rose-200 hover:bg-rose-200",
    active: "bg-rose-600 border border-rose-600 shadow-lg shadow-rose-500/20",
    icon: "bg-white/70 text-rose-700",
    iconActive: "bg-white/20 text-white",
    title: "text-rose-900",
    titleActive: "text-white",
    subtitle: "text-rose-800/70",
    subtitleActive: "text-rose-50/90",
    count: "text-rose-700/70",
    countActive: "text-rose-50/80",
  },
  {
    base: "bg-emerald-100 border border-emerald-200 hover:bg-emerald-200",
    active: "bg-emerald-600 border border-emerald-600 shadow-lg shadow-emerald-500/20",
    icon: "bg-white/70 text-emerald-700",
    iconActive: "bg-white/20 text-white",
    title: "text-emerald-900",
    titleActive: "text-white",
    subtitle: "text-emerald-800/70",
    subtitleActive: "text-emerald-50/90",
    count: "text-emerald-700/70",
    countActive: "text-emerald-50/80",
  },
  {
    base: "bg-stone-800 border border-stone-800 hover:bg-stone-700",
    active: "bg-stone-900 border border-stone-900 shadow-lg shadow-stone-900/20",
    icon: "bg-white/10 text-stone-100",
    iconActive: "bg-white/15 text-white",
    title: "text-white",
    titleActive: "text-white",
    subtitle: "text-stone-300",
    subtitleActive: "text-stone-200",
    count: "text-stone-400",
    countActive: "text-stone-300",
  },
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDept = departments[activeIndex];
  const activeStyle = palette[activeIndex % palette.length];
  const ActiveIcon = activeDept?.icon;

  return (
    <div className="min-h-screen bg-orange-50 text-stone-900 selection:bg-amber-300/40 font-sans relative">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-300/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-300/20 blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <header className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">{schoolName}</h1>
          <p className="mt-3 text-stone-600">{introText}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 items-start">
          {/* Left: department pill list */}
          <div className="space-y-3">
            {departments.map((dept, i) => {
              const Icon = dept.icon;
              const style = palette[i % palette.length];
              const isActive = i === activeIndex;
              return (
                <button
                  key={dept.name}
                  onClick={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 ${isActive ? style.active : style.base}`}
                >
                  <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors duration-200 ${isActive ? style.iconActive : style.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate transition-colors duration-200 ${isActive ? style.titleActive : style.title}`}>
                      {dept.name}
                    </p>
                    <p className={`text-xs truncate transition-colors duration-200 ${isActive ? style.subtitleActive : style.subtitle}`}>
                      {dept.description}
                    </p>
                  </div>
                  <span className={`text-[11px] font-mono shrink-0 transition-colors duration-200 ${isActive ? style.countActive : style.count}`}>
                    {`${String(i + 1).padStart(2, "0")} // ${dept.apps.length}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: apps of the selected department */}
          <div className="bg-white/95 backdrop-blur-xl border border-stone-200 rounded-3xl p-6 sm:p-7 shadow-xl min-h-[240px]">
            {activeDept && (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full ${activeStyle.icon}`}>
                    {ActiveIcon && <ActiveIcon className="w-5 h-5" />}
                  </div>
                  <h2 className="flex-1 min-w-0 text-lg font-bold text-stone-900 truncate">{activeDept.name}</h2>
                  <span className="text-xs font-mono text-stone-400 shrink-0">
                    {String(activeIndex + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-sm text-stone-600 mb-5 ml-14 -mt-0.5">{activeDept.description}</p>

                <div className="space-y-3">
                  {activeDept.apps.map((app) => {
                    const AppIcon = app.icon;
                    return (
                      <Link
                        key={app.href}
                        href={app.href}
                        className="group flex items-center gap-4 p-4 bg-stone-50 hover:bg-white border border-stone-200 hover:border-amber-300 rounded-2xl transition-all duration-200"
                      >
                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                          <AppIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-stone-900 group-hover:text-amber-700 transition-colors">
                            {app.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-stone-600 leading-relaxed">{app.description}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </Link>
                    );
                  })}
                  {activeDept.apps.length === 0 && (
                    <div className="text-center py-10 text-sm text-stone-400">아직 등록된 프로그램이 없습니다.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
