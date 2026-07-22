"use client";

import { useState } from "react";
import type { ConfirmModalFields } from "./ConfirmModal";

interface AnalyzeResult {
  number: string | null;
  institution: string | null;
  date: string | null;
  extractionFailed?: boolean;
  reason?: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useSubmitCertificate() {
  const [trainingTitle, setTrainingTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);

  const handleFileChange = (selected: File | null) => {
    setError(null);
    setSuccessMessage(null);
    if (selected && selected.size > MAX_FILE_BYTES) {
      setFileError("파일 크기는 10MB 이하여야 합니다.");
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(selected);
  };

  const handleAnalyze = async () => {
    if (!file || !trainingTitle.trim()) {
      setError("연수 제목과 이수증 파일을 모두 입력해주세요.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setNoApiKey(false);
    try {
      const base64 = await fileToBase64(file);
      setPendingBase64(base64);
      const res = await fetch("/api/schedule-helper/certificates/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type || "application/octet-stream", fileName: file.name }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "분석 중 오류가 발생했습니다.");
        return;
      }
      setAnalyzeResult(body);
      if (body.reason === "no_api_key") setNoApiKey(true);
      setModalOpen(true);
    } catch {
      setError("파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmSubmit = async (fields: ConfirmModalFields) => {
    if (!file || !pendingBase64) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule-helper/certificates/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingTitle: trainingTitle.trim(),
          number: fields.number,
          institution: fields.institution,
          certDate: fields.date,
          base64: pendingBase64,
          mimeType: file.type || "application/octet-stream",
          fileName: file.name,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "제출 중 오류가 발생했습니다.");
        return;
      }
      setModalOpen(false);
      setSuccessMessage("이수증이 성공적으로 제출되었습니다!");
      setTrainingTitle("");
      setFile(null);
      setPendingBase64(null);
      setAnalyzeResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelModal = () => {
    setModalOpen(false);
    setPendingBase64(null);
    setAnalyzeResult(null);
  };

  return {
    trainingTitle,
    setTrainingTitle,
    file,
    fileError,
    handleFileChange,
    analyzing,
    submitting,
    analyzeResult,
    modalOpen,
    error,
    successMessage,
    noApiKey,
    handleAnalyze,
    handleConfirmSubmit,
    handleCancelModal,
  };
}
