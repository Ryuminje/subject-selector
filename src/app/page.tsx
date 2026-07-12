"use client";
import React, { useState } from "react";
import { Settings, FileText, GitBranch } from "lucide-react";
import { DemandSurveyTab } from "../components/tabs/DemandSurveyTab";
import { ChangeSurveyTab } from "../components/tabs/ChangeSurveyTab";
import { MainSurveyTab } from "../components/tabs/MainSurveyTab";

export default function Home() {
  const [activeSidebarTab, setActiveSidebarTab] = useState<"survey" | "main" | "change">("survey");

  return (
    <div className="flex min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 font-sans">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px]" />
      </div>

      {/* Sidebar Container */}
      <aside className="fixed top-12 left-0 h-[calc(100vh-3rem)] z-[999] flex flex-col gap-6 pointer-events-none w-16">
        
        {/* Logo/Brand */}
        <div className="flex items-center h-[72px] w-16 hover:w-64 p-4 bg-slate-900/95 backdrop-blur-xl border-y border-r border-slate-800/80 rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] pointer-events-auto transition-all duration-300 overflow-hidden group">
          <div className="w-8 h-8 flex flex-shrink-0 justify-center items-center text-indigo-400">
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </div>
          <span className="ml-4 font-bold text-lg whitespace-nowrap tracking-wide bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Subject Selector
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-4 pointer-events-auto">
          
          <button
            onClick={() => setActiveSidebarTab("survey")}
            className={`relative flex items-center px-4 h-[60px] transition-all duration-300 group overflow-hidden bg-slate-900/95 backdrop-blur-xl border-y border-r border-slate-800/80 rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] w-16 hover:w-64 ${activeSidebarTab === "survey" ? 'border-r-indigo-500/50 bg-slate-800/80' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`w-8 h-8 flex flex-shrink-0 justify-center items-center rounded-xl transition-all duration-300 ${activeSidebarTab === "survey" ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-slate-400 group-hover:text-indigo-300'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className={`ml-4 font-medium whitespace-nowrap transition-all duration-300 ${activeSidebarTab === "survey" ? 'text-indigo-300 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
              수요조사 탭
            </span>
            {activeSidebarTab === "survey" && (
              <div className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            )}
          </button>

          <button
            onClick={() => setActiveSidebarTab("change")}
            className={`relative flex items-center px-4 h-[60px] transition-all duration-300 group overflow-hidden bg-slate-900/95 backdrop-blur-xl border-y border-r border-slate-800/80 rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] w-16 hover:w-64 ${activeSidebarTab === "change" ? 'border-r-rose-500/50 bg-slate-800/80' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`w-8 h-8 flex flex-shrink-0 justify-center items-center rounded-xl transition-all duration-300 ${activeSidebarTab === "change" ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'text-slate-400 group-hover:text-rose-300'}`}>
              <GitBranch className="w-5 h-5" />
            </div>
            <span className={`ml-4 font-medium whitespace-nowrap transition-all duration-300 ${activeSidebarTab === "change" ? 'text-rose-300 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
              선택과목 변경 탭
            </span>
            {activeSidebarTab === "change" && (
              <div className="absolute left-0 w-1 h-8 bg-rose-500 rounded-r-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            )}
          </button>

          <button
            onClick={() => setActiveSidebarTab("main")}
            className={`relative flex items-center px-4 h-[60px] transition-all duration-300 group overflow-hidden bg-slate-900/95 backdrop-blur-xl border-y border-r border-slate-800/80 rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] w-16 hover:w-64 ${activeSidebarTab === "main" ? 'border-r-emerald-500/50 bg-slate-800/80' : 'hover:bg-slate-800/50'}`}
          >
            <div className={`w-8 h-8 flex flex-shrink-0 justify-center items-center rounded-xl transition-all duration-300 ${activeSidebarTab === "main" ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-slate-400 group-hover:text-emerald-300'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className={`ml-4 font-medium whitespace-nowrap transition-all duration-300 ${activeSidebarTab === "main" ? 'text-emerald-300 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
              수강신청(본조사) 탭
            </span>
            {activeSidebarTab === "main" && (
              <div className="absolute left-0 w-1 h-8 bg-emerald-500 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 overflow-x-hidden overflow-y-auto ml-16 transition-none">
        <div className={activeSidebarTab === "survey" ? "block" : "hidden"}>
          <DemandSurveyTab />
        </div>
        <div className={activeSidebarTab === "main" ? "block" : "hidden"}>
          <MainSurveyTab />
        </div>
        <div className={activeSidebarTab === "change" ? "block" : "hidden"}>
          <ChangeSurveyTab />
        </div>
      </main>
    </div>
  );
}