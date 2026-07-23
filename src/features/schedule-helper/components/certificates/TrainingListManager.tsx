"use client";

import { useState } from "react";
import { ListChecks, QrCode, ListOrdered } from "lucide-react";
import TrainingTitleManager from "./TrainingTitleManager";
import RosterPresetManager from "./RosterPresetManager";
import { useRosterPresets } from "./useRosterPresets";

type SubTab = "certificate" | "sign" | "presets";

export default function TrainingListManager({ isAdmin }: { isAdmin: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>("certificate");
  const rosterPresets = useRosterPresets();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-teal-100">
        <button
          onClick={() => setSubTab("certificate")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex-1 justify-center ${
            subTab === "certificate"
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
          }`}
        >
          <ListChecks className="w-4 h-4" /> 이수증 수거 관리
        </button>
        <button
          onClick={() => setSubTab("sign")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex-1 justify-center ${
            subTab === "sign"
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
          }`}
        >
          <QrCode className="w-4 h-4" /> 서명 연수 관리 (QR서명)
        </button>
        <button
          onClick={() => setSubTab("presets")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex-1 justify-center ${
            subTab === "presets"
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
          }`}
        >
          <ListOrdered className="w-4 h-4" /> 명단 프리셋 관리
        </button>
      </div>

      {subTab === "certificate" && <TrainingTitleManager isAdmin={isAdmin} category="certificate" />}
      {subTab === "sign" && <TrainingTitleManager isAdmin={isAdmin} category="sign" />}
      {subTab === "presets" && (
        <RosterPresetManager
          presets={rosterPresets.presets}
          loadingPresets={rosterPresets.loadingPresets}
          createPreset={rosterPresets.createPreset}
          updatePreset={rosterPresets.updatePreset}
          deletePreset={rosterPresets.deletePreset}
          fetchBaseRoster={rosterPresets.fetchBaseRoster}
        />
      )}
    </div>
  );
}
