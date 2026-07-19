"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, Settings, CheckCircle2, Save, FolderOpen, GitBranch } from "lucide-react";
import { useMainCurriculum } from "../../features/main-survey/hooks/useMainCurriculum";
import { useMainUploads } from "../../features/main-survey/hooks/useMainUploads";
import { useMainClassSummary } from "../../features/main-survey/hooks/useMainClassSummary";
import { CurriculumStep } from "../../features/main-survey/components/CurriculumStep";
import { HierarchyStep } from "../../features/main-survey/components/HierarchyStep";
import { UploadStep } from "../../features/main-survey/components/UploadStep";
import { PreviewStep } from "../../features/main-survey/components/PreviewStep";
import { ClassOpeningStep } from "../../features/main-survey/components/ClassOpeningStep";
import { CategorySummaryStep } from "../../features/main-survey/components/CategorySummaryStep";
import type { GradeKey } from "../../types";

export function MainSurveyTab() {
  const [activeTab, setActiveTab] = useState("curriculum");
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const {
    parsedCurriculumList, setParsedCurriculumList,
    subjectMap, setSubjectMap,
    isCurriculumParsed, setIsCurriculumParsed,
    hierarchyRules, setHierarchyRules,
    designatedSubjects, setDesignatedSubjects,
    selectedSubjectHours, setSelectedSubjectHours,
    editingDetailedCategory, setEditingDetailedCategory,
    detailedCategoryEditValue, setDetailedCategoryEditValue,
    handleCurriculumUpload,
    handleDetailedCategoryUpdate,
  } = useMainCurriculum(activeGrade);

  const {
    uploadedFiles, setUploadedFiles,
    processedData, setProcessedData,
    rawSheetData, setRawSheetData,
    previousHistoryFiles, setPreviousHistoryFiles,
    previousSubjectMap, setPreviousSubjectMap,
    subjectStats, setSubjectStats,
    totalClasses, setTotalClasses,
    handleFileUpload,
    handlePrevHistoryFileUpload,
    handleRemoveFile,
    handleRemovePrevHistoryFile,
  } = useMainUploads(activeGrade, parsedCurriculumList, subjectMap, hierarchyRules);

  const [standardClassSize, setStandardClassSize] = useState<{ [key in GradeKey]: number }>({ pre1: 25, grade1: 25, grade2: 25 });
  const [manualClassCounts, setManualClassCounts] = useState<{ [subjectKey: string]: number }>({});
  const [editingClasses, setEditingClasses] = useState<{ [subjectKey: string]: boolean }>({});
  const [teacherCounts, setTeacherCounts] = useState<{ [category: string]: number }>({});
  const [headTeacherReductions, setHeadTeacherReductions] = useState<{ [category: string]: number }>({});
  const [headTeacherCategoryInput, setHeadTeacherCategoryInput] = useState<string>("");
  const [editingTeachers, setEditingTeachers] = useState<{ [category: string]: boolean }>({});
  const [manualStep5Classes, setManualStep5Classes] = useState<{ [key: string]: string }>({});
  const [editingStep5Classes, setEditingStep5Classes] = useState<{ [key: string]: boolean }>({});


  const fileInputRef = useRef<HTMLInputElement>(null);

  if (typeof window !== "undefined") {
    (window as any).getMainBackup = () => ({
    activeGrade,
    parsedCurriculumList,
    subjectMap,
    isCurriculumParsed,
    hierarchyRules,
    uploadedFiles,
    processedData,
    rawSheetData,
    previousHistoryFiles,
    previousSubjectMap,
    subjectStats,
    standardClassSize,
    totalClasses,
    manualClassCounts,
    manualStep5Classes,
    teacherCounts,
    designatedSubjects,
    selectedSubjectHours,
    headTeacherReductions
  });

  (window as any).loadMainBackup = (parsed: any) => {
    if (parsed.activeGrade) setActiveGrade(parsed.activeGrade);
    if (parsed.parsedCurriculumList) setParsedCurriculumList({ pre1: [], grade1: [], grade2: [], ...parsed.parsedCurriculumList });
    if (parsed.subjectMap) setSubjectMap({ pre1: {}, grade1: {}, grade2: {}, ...parsed.subjectMap });
    if (parsed.isCurriculumParsed) setIsCurriculumParsed({ pre1: false, ...parsed.isCurriculumParsed });
    if (parsed.hierarchyRules) setHierarchyRules({ pre1: [], ...parsed.hierarchyRules });
    if (parsed.uploadedFiles) setUploadedFiles({ pre1: null, grade1: null, grade2: null, ...parsed.uploadedFiles });
    if (parsed.processedData) setProcessedData({ pre1: [], grade1: [], grade2: [], ...parsed.processedData });
    if (parsed.rawSheetData) setRawSheetData({ pre1: [], grade1: [], grade2: [], ...parsed.rawSheetData });
    if (parsed.previousHistoryFiles) setPreviousHistoryFiles({ pre1: null, grade1: null, grade2: null, ...parsed.previousHistoryFiles });
    if (parsed.previousSubjectMap) setPreviousSubjectMap({ pre1: {}, grade1: {}, grade2: {}, ...parsed.previousSubjectMap });
    if (parsed.subjectStats) setSubjectStats({ pre1: [], grade1: [], grade2: [], ...parsed.subjectStats });
    if (parsed.standardClassSize) setStandardClassSize({ pre1: 25, ...parsed.standardClassSize });
    if (parsed.totalClasses) setTotalClasses({ pre1: 10, grade1: 10, grade2: 10, ...parsed.totalClasses });
    if (parsed.manualClassCounts) setManualClassCounts(parsed.manualClassCounts);
    if (parsed.manualStep5Classes) setManualStep5Classes(parsed.manualStep5Classes);
    if (parsed.teacherCounts) setTeacherCounts(parsed.teacherCounts);
    if (parsed.headTeacherReductions) setHeadTeacherReductions(parsed.headTeacherReductions);
    if (parsed.designatedSubjects) setDesignatedSubjects({ pre1: [], ...parsed.designatedSubjects });
    if (parsed.selectedSubjectHours) setSelectedSubjectHours({ pre1: [], ...parsed.selectedSubjectHours });
  };
  }

  const handleSaveBackup = async () => {
    const fullBackup = {
      version: 2,
      demand: (window as any).getDemandBackup?.() || {},
      main: (window as any).getMainBackup?.() || {},
      change: (window as any).getChangeBackup?.() || {}
    };
    
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수강신청(본조사) 및 선택과목 변경.json";

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


  const activeData = processedData[activeGrade];

  const {
    handleExport,
    handleExportStep5,
    categorySummaryData,
    handleExportCategorySummary,
  } = useMainClassSummary(
    activeGrade,
    processedData,
    subjectStats,
    standardClassSize,
    manualStep5Classes,
    designatedSubjects,
    manualClassCounts,
    totalClasses,
    teacherCounts,
    headTeacherReductions,
    parsedCurriculumList,
    subjectMap,
  );



  return ( <>
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-slate-800/30 bg-slate-950/40 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              명신고등학교 수강신청(본조사) 데이터 정리
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
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 text-sm font-medium rounded-xl transition-all border border-slate-700/60 shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                불러오기
              </button>
              <button
                onClick={handleSaveBackup}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all border border-indigo-500/50 shadow-md shadow-indigo-500/20"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
          
          <div className="w-full">
            <div className="flex gap-2 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 w-fit overflow-x-auto max-w-[calc(100vw-120px)] scrollbar-hide">
                  <button onClick={() => setActiveTab('curriculum')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'curriculum' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>교육과정 편성표 입력</span></div></button>
                  <button onClick={() => setActiveTab('hierarchy')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'hierarchy' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><GitBranch className="w-4 h-4" /><span>과목 위계 설정</span></div></button>
                  <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'upload' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'preview' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>수강신청(본조사) 결과</span></div></button>
                  <button onClick={() => setActiveTab('classOpening')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'classOpening' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>과목 개설 여부</span></div></button>
                  <button onClick={() => setActiveTab('categorySummary')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'categorySummary' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>교과(군)별 시수 정리</span></div></button>
                </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
                  {activeTab === "curriculum" && (
                    <CurriculumStep
                      activeGrade={activeGrade}
                      setActiveGrade={setActiveGrade}
                      setIsExampleModalOpen={setIsExampleModalOpen}
                      handleCurriculumUpload={handleCurriculumUpload}
                      isCurriculumParsed={isCurriculumParsed}
                      parsedCurriculumList={parsedCurriculumList}
                      editingDetailedCategory={editingDetailedCategory}
                      setEditingDetailedCategory={setEditingDetailedCategory}
                      detailedCategoryEditValue={detailedCategoryEditValue}
                      setDetailedCategoryEditValue={setDetailedCategoryEditValue}
                      handleDetailedCategoryUpdate={handleDetailedCategoryUpdate}
                      setActiveTab={setActiveTab}
                    />
                  )}
                  {activeTab === "hierarchy" && (
                    <HierarchyStep
                      activeGrade={activeGrade}
                      setActiveGrade={setActiveGrade}
                      isCurriculumParsed={isCurriculumParsed}
                      subjectMap={subjectMap}
                      hierarchyRules={hierarchyRules}
                      setHierarchyRules={setHierarchyRules}
                      setActiveTab={setActiveTab}
                    />
                  )}
                  {activeTab === "upload" && (
                    <UploadStep
                      activeGrade={activeGrade}
                      setActiveGrade={setActiveGrade}
                      uploadedFiles={uploadedFiles}
                      handleFileUpload={handleFileUpload}
                      handleRemoveFile={handleRemoveFile}
                      setActiveTab={setActiveTab}
                      previousHistoryFiles={previousHistoryFiles}
                      handlePrevHistoryFileUpload={handlePrevHistoryFileUpload}
                      handleRemovePrevHistoryFile={handleRemovePrevHistoryFile}
                      previousSubjectMap={previousSubjectMap}
                    />
                  )}
                  {activeTab === "preview" && (
                    <PreviewStep
                      activeGrade={activeGrade}
                      setActiveGrade={setActiveGrade}
                      handleExport={handleExport}
                      activeData={activeData}
                    />
                  )}
                  {activeTab === "classOpening" && (
                    <ClassOpeningStep
                      activeGrade={activeGrade}
                      setActiveGrade={setActiveGrade}
                      handleExportStep5={handleExportStep5}
                      subjectStats={subjectStats}
                      standardClassSize={standardClassSize}
                      setStandardClassSize={setStandardClassSize}
                      manualStep5Classes={manualStep5Classes}
                      setManualStep5Classes={setManualStep5Classes}
                      editingStep5Classes={editingStep5Classes}
                      setEditingStep5Classes={setEditingStep5Classes}
                    />
                  )}
                  {activeTab === "categorySummary" && (
                    <CategorySummaryStep
                      handleExportCategorySummary={handleExportCategorySummary}
                      categorySummaryData={categorySummaryData}
                      totalClasses={totalClasses}
                      setTotalClasses={setTotalClasses}
                      setManualClassCounts={setManualClassCounts}
                      headTeacherCategoryInput={headTeacherCategoryInput}
                      setHeadTeacherCategoryInput={setHeadTeacherCategoryInput}
                      headTeacherReductions={headTeacherReductions}
                      setHeadTeacherReductions={setHeadTeacherReductions}
                      teacherCounts={teacherCounts}
                      setTeacherCounts={setTeacherCounts}
                      editingTeachers={editingTeachers}
                      setEditingTeachers={setEditingTeachers}
                      manualClassCounts={manualClassCounts}
                      editingClasses={editingClasses}
                      setEditingClasses={setEditingClasses}
                    />
                  )}
                </div>

          </div>
        </div>
      </> );
}
