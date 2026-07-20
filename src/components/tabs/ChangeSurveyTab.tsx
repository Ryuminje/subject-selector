"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, Settings, Download, Save, FolderOpen, Users } from "lucide-react";
import { useTimetableData } from "../../features/change-survey/hooks/useTimetableData";
import { useChangeCurriculum } from "../../features/change-survey/hooks/useChangeCurriculum";
import { useChangeUploads } from "../../features/change-survey/hooks/useChangeUploads";
import { useElectiveChanges } from "../../features/change-survey/hooks/useElectiveChanges";
import { useStep6Data } from "../../features/change-survey/hooks/useStep6Data";
import { useChangeExports } from "../../features/change-survey/hooks/useChangeExports";
import { BasicStep } from "../../features/change-survey/components/BasicStep";
import { UploadStep } from "../../features/change-survey/components/UploadStep";
import { TimetableStep } from "../../features/change-survey/components/TimetableStep";
import { ApplicationStep } from "../../features/change-survey/components/ApplicationStep";
import { RosterStep } from "../../features/change-survey/components/RosterStep";
import { RosterAfterStep } from "../../features/change-survey/components/RosterAfterStep";
import { AnalysisStep } from "../../features/change-survey/components/AnalysisStep";
import { RiroschoolStep } from "../../features/change-survey/components/RiroschoolStep";

export function ChangeSurveyTab() {
  const [changeActiveTab, setChangeActiveTab] = useState<"basic" | "upload" | "timetable" | "roster" | "application" | "roster_after" | "analysis" | "riroschool">("basic");
  const [changeActiveGrade, setChangeActiveGrade] = useState<"grade2" | "grade3">("grade2");
  const [showOnlyApplicants, setShowOnlyApplicants] = useState(false);
  const [changeRosterTimeSlot, setChangeRosterTimeSlot] = useState("A");
  const [rosterAfterSubjectFilter, setRosterAfterSubjectFilter] = useState<string>("전체");
  const [rosterSubjectFilter, setRosterSubjectFilter] = useState<string>("전체");


  const {
    timeSlots, setTimeSlots,
    classCols, setClassCols,
    timetableData, setTimetableData,
    handleTimetablePaste,
    addTimeSlot,
    addClassCol,
    removeTimeSlot,
    removeClassCol,
    updateTimetableCell,
  } = useTimetableData(changeActiveGrade);

  const {
    sampleRawData, setSampleRawData,
    parsedSampleData, setParsedSampleData,
    grade2HistoryData, setGrade2HistoryData,
    grade3Sem1HistoryData, setGrade3Sem1HistoryData,
    extraUploads, setExtraUploads,
    changeUploadNames, setChangeUploadNames,
    handleDeleteSampleUpload,
    handleDeleteExtraUpload,
    handleExtraUpload,
    handleChangeSampleUpload,
  } = useChangeUploads(changeActiveGrade);

  const {
    electiveChanges, setElectiveChanges,
    electiveChangesArbitrary, setElectiveChangesArbitrary,
    enableOptimization, setEnableOptimization,
    adjustmentLog,
  } = useElectiveChanges(changeActiveGrade, parsedSampleData, timetableData, timeSlots, classCols);

  const {
    changeParsedCurriculumList, setChangeParsedCurriculumList,
    changeSubjectMap, setChangeSubjectMap,
    changeIsCurriculumParsed, setChangeIsCurriculumParsed,
    changeHierarchyRules, setChangeHierarchyRules,
    handleChangeCurriculumUpload,
    getChangeSubjectCategory,
  } = useChangeCurriculum(changeActiveGrade);

  if (typeof window !== "undefined") {
    (window as any).getChangeBackup = () => ({
    changeActiveGrade,
    changeParsedCurriculumList,
    changeSubjectMap,
    changeIsCurriculumParsed,
    changeHierarchyRules,
    parsedSampleData,
    timetableData,
    electiveChanges,
    timeSlots,
    classCols,
    grade2HistoryData,
    grade3Sem1HistoryData,
    extraUploads,
    changeUploadNames,
    sampleRawData
  });

  (window as any).loadChangeBackup = (parsed: any) => {
    if (parsed.changeActiveGrade) setChangeActiveGrade(parsed.changeActiveGrade);
    if (parsed.changeParsedCurriculumList) setChangeParsedCurriculumList(parsed.changeParsedCurriculumList);
    if (parsed.changeSubjectMap) setChangeSubjectMap(parsed.changeSubjectMap);
    if (parsed.changeIsCurriculumParsed) setChangeIsCurriculumParsed(parsed.changeIsCurriculumParsed);
    if (parsed.changeHierarchyRules) setChangeHierarchyRules(parsed.changeHierarchyRules);
    if (parsed.parsedSampleData) setParsedSampleData(parsed.parsedSampleData);
    if (parsed.sampleRawData) setSampleRawData(parsed.sampleRawData);
    if (parsed.timetableData) setTimetableData(parsed.timetableData);
    if (parsed.electiveChanges) setElectiveChanges(parsed.electiveChanges);
    if (parsed.timeSlots) setTimeSlots(parsed.timeSlots);
    if (parsed.classCols) setClassCols(parsed.classCols);
    if (parsed.grade2HistoryData) {
      if (parsed.grade2HistoryData.grade2 || parsed.grade2HistoryData.grade3) {
        const trimmed: Record<string, Record<string, string[]>> = { grade2: {}, grade3: {} };
        for (const g of ["grade2", "grade3"]) {
          if (parsed.grade2HistoryData[g]) {
            for (const k in parsed.grade2HistoryData[g]) trimmed[g][k.trim()] = parsed.grade2HistoryData[g][k];
          }
        }
        setGrade2HistoryData(trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade2HistoryData) trimmed[k.trim()] = parsed.grade2HistoryData[k];
        setGrade2HistoryData({ grade2: trimmed, grade3: trimmed });
      }
    }
    if (parsed.grade3Sem1HistoryData) {
      if (parsed.grade3Sem1HistoryData.grade2 || parsed.grade3Sem1HistoryData.grade3) {
        const trimmed: Record<string, Record<string, string[]>> = { grade2: {}, grade3: {} };
        for (const g of ["grade2", "grade3"]) {
          if (parsed.grade3Sem1HistoryData[g]) {
            for (const k in parsed.grade3Sem1HistoryData[g]) trimmed[g][k.trim()] = parsed.grade3Sem1HistoryData[g][k];
          }
        }
        setGrade3Sem1HistoryData(trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade3Sem1HistoryData) trimmed[k.trim()] = parsed.grade3Sem1HistoryData[k];
        setGrade3Sem1HistoryData({ grade2: trimmed, grade3: trimmed });
      }
    }
    if (parsed.extraUploads) {
      if (parsed.extraUploads.grade2 || parsed.extraUploads.grade3) {
        setExtraUploads(parsed.extraUploads);
      } else {
        setExtraUploads({ grade2: parsed.extraUploads, grade3: parsed.extraUploads });
      }
    }
    if (parsed.changeUploadNames) {
      setChangeUploadNames(parsed.changeUploadNames);
    }
  };
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = async () => {
    const fullBackup = {
      version: 2,
      demand: (window as any).getDemandBackup?.() || {},
      main: (window as any).getMainBackup?.() || {},
      change: (window as any).getChangeBackup?.() || {}
    };
    
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수요조사 및 선택과목 변경.json";

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'JSON 파일',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
      } else {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err);
        alert('파일 저장 중 오류가 발생했습니다.');
      }
    }
  };

  const handleLoadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.version === 2) {
          (window as any).loadDemandBackup?.(parsed.demand || {});
          (window as any).loadMainBackup?.(parsed.main || {});
          (window as any).loadChangeBackup?.(parsed.change || {});
        } else {
          (window as any).loadDemandBackup?.(parsed);
          (window as any).loadMainBackup?.(parsed);
          (window as any).loadChangeBackup?.(parsed);
        }
        
        alert("작업 내역을 성공적으로 불러왔습니다.");
      } catch (err) {
        console.error("Failed to parse file:", err);
        alert("파일 형식이 잘못되었습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const step6Data = useStep6Data(
    changeActiveTab,
    changeActiveGrade,
    parsedSampleData,
    grade2HistoryData,
    grade3Sem1HistoryData,
    adjustmentLog,
    changeHierarchyRules,
    timeSlots,
    getChangeSubjectCategory,
  );

  const {
    handleExportRoster,
    handleExportAttendanceRoster,
    handleExportChanges,
    handleDownloadRiroschool,
    handleExportStep6,
    handleExportTimetable,
  } = useChangeExports(
    changeActiveGrade,
    parsedSampleData,
    sampleRawData,
    timetableData,
    timeSlots,
    classCols,
    adjustmentLog,
    electiveChanges,
    electiveChangesArbitrary,
    step6Data,
  );

  return ( <>
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
              명신고등학교 선택과목 변경 시스템
            </h1>
            
            <div className="flex gap-2 shrink-0">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleLoadBackup}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-xl transition-all border border-stone-300 shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                불러오기
              </button>
              <button
                onClick={handleSaveBackup}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all border border-amber-500/50 shadow-md shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
          
          <div className="w-full">
            <div className="flex gap-2 p-1 bg-stone-100/80 backdrop-blur-md rounded-2xl border border-stone-200 w-fit overflow-x-auto max-w-[calc(100vw-120px)] scrollbar-hide">
                  <button onClick={() => setChangeActiveTab('basic')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'basic' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>기초자료 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'upload' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setChangeActiveTab('timetable')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'timetable' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>타임별 시간표 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'roster' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('application')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'application' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>선택과목 변경 데이터 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster_after')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'roster_after' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>변경 후 타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('analysis')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'analysis' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">7단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>다년도 분석</span></div></button>
                  <button onClick={() => setChangeActiveTab('riroschool')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'riroschool' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">8단계</span><div className="flex items-center gap-1.5"><Download className="w-4 h-4" /><span>리로스쿨용 파일</span></div></button>
                </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

                <div className="bg-white/70 backdrop-blur-xl border border-stone-200 rounded-3xl p-8 shadow-xl">
                                    {changeActiveTab === "basic" && (
                    <BasicStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleChangeCurriculumUpload={handleChangeCurriculumUpload}
                      changeIsCurriculumParsed={changeIsCurriculumParsed}
                      changeParsedCurriculumList={changeParsedCurriculumList}
                      changeSubjectMap={changeSubjectMap}
                      changeHierarchyRules={changeHierarchyRules}
                      setChangeHierarchyRules={setChangeHierarchyRules}
                      setChangeActiveTab={setChangeActiveTab}
                    />
                  )}

{changeActiveTab === "upload" && (
                    <UploadStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      parsedSampleData={parsedSampleData}
                      changeUploadNames={changeUploadNames}
                      extraUploads={extraUploads}
                      handleDeleteSampleUpload={handleDeleteSampleUpload}
                      handleChangeSampleUpload={handleChangeSampleUpload}
                      handleDeleteExtraUpload={handleDeleteExtraUpload}
                      handleExtraUpload={handleExtraUpload}
                      setChangeActiveTab={setChangeActiveTab}
                    />
                  )}

                  {changeActiveTab === "timetable" && (
                    <TimetableStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportTimetable={handleExportTimetable}
                      addTimeSlot={addTimeSlot}
                      addClassCol={addClassCol}
                      removeClassCol={removeClassCol}
                      removeTimeSlot={removeTimeSlot}
                      classCols={classCols}
                      timeSlots={timeSlots}
                      timetableData={timetableData}
                      updateTimetableCell={updateTimetableCell}
                      handleTimetablePaste={handleTimetablePaste}
                    />
                  )}

                  {changeActiveTab === "application" && (
                    <ApplicationStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      electiveChanges={electiveChanges}
                      setElectiveChanges={setElectiveChanges}
                      electiveChangesArbitrary={electiveChangesArbitrary}
                      setElectiveChangesArbitrary={setElectiveChangesArbitrary}
                      enableOptimization={enableOptimization}
                      setEnableOptimization={setEnableOptimization}
                      handleExportChanges={handleExportChanges}
                      adjustmentLog={adjustmentLog}
                    />
                  )}

                  {changeActiveTab === "roster_after" && (
                    <RosterAfterStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportAttendanceRoster={handleExportAttendanceRoster}
                      handleExportRoster={handleExportRoster}
                      timeSlots={timeSlots}
                      classCols={classCols}
                      timetableData={timetableData}
                      rosterAfterSubjectFilter={rosterAfterSubjectFilter}
                      setRosterAfterSubjectFilter={setRosterAfterSubjectFilter}
                      changeRosterTimeSlot={changeRosterTimeSlot}
                      setChangeRosterTimeSlot={setChangeRosterTimeSlot}
                      parsedSampleData={parsedSampleData}
                      adjustmentLog={adjustmentLog}
                    />
                  )}


                  {changeActiveTab === "roster" && (
                    <RosterStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportRoster={handleExportRoster}
                      timeSlots={timeSlots}
                      classCols={classCols}
                      timetableData={timetableData}
                      rosterSubjectFilter={rosterSubjectFilter}
                      setRosterSubjectFilter={setRosterSubjectFilter}
                      changeRosterTimeSlot={changeRosterTimeSlot}
                      setChangeRosterTimeSlot={setChangeRosterTimeSlot}
                      parsedSampleData={parsedSampleData}
                    />
                  )}
                  {changeActiveTab === "analysis" && (
                    <AnalysisStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportStep6={handleExportStep6}
                      step6Data={step6Data}
                      showOnlyApplicants={showOnlyApplicants}
                      setShowOnlyApplicants={setShowOnlyApplicants}
                      timeSlots={timeSlots}
                      adjustmentLog={adjustmentLog}
                    />
                  )}
                  
                  {changeActiveTab === "riroschool" && (
                    <RiroschoolStep
                      sampleRawData={sampleRawData}
                      handleDownloadRiroschool={handleDownloadRiroschool}
                    />
                  )}

                </div>

          </div>
        </div>
      </> );
}
