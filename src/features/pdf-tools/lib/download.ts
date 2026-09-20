// 브라우저에서 만든 결과물을 파일로 저장합니다(서버를 거치지 않음).

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 바로 해제하면 일부 브라우저에서 저장이 끊깁니다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadPdf = (bytes: Uint8Array, fileName: string) =>
  downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), fileName);

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** "보고서.pdf" → "보고서" */
export const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
