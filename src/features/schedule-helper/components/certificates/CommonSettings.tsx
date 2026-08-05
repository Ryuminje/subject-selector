"use client";

import { Users } from "lucide-react";
import RosterPresetManager from "./RosterPresetManager";
import ExtraRosterSettings from "./ExtraRosterSettings";
import GeminiKeySettings from "./GeminiKeySettings";
import { useRosterPresets } from "./useRosterPresets";

// 이수증 수거와 QR 서명이 함께 쓰는 설정만 모은 탭.
// 명단 프리셋은 카테고리 구분 없이 공통이라 여기 한 곳에서만 관리합니다.
export default function CommonSettings({ isAdmin }: { isAdmin: boolean }) {
  const rosterPresets = useRosterPresets();

  return (
    <div className="space-y-5">
      <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <Users className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="text-sm text-teal-800">
          여기서 만든 <strong className="font-bold">명단 프리셋은 이수증 연수와 서명 연수 양쪽에서 공통</strong>으로
          쓰입니다. 연수를 등록하거나 편집할 때 프리셋 버튼을 눌러 명단을 그대로 불러올 수 있습니다.
        </p>
      </div>

      <RosterPresetManager
        isAdmin={isAdmin}
        presets={rosterPresets.presets}
        loadingPresets={rosterPresets.loadingPresets}
        createPreset={rosterPresets.createPreset}
        updatePreset={rosterPresets.updatePreset}
        deletePreset={rosterPresets.deletePreset}
        fetchBaseRoster={rosterPresets.fetchBaseRoster}
      />

      {isAdmin && <ExtraRosterSettings />}
      {isAdmin && <GeminiKeySettings />}
    </div>
  );
}
