/**
 * 파일 저장 — 저장 위치를 사용자가 고르게 합니다.
 *
 * 구 버전은 tkinter의 "다른 이름으로 저장" 대화상자를 띄웠습니다. 브라우저에서는
 * File System Access API(`showSaveFilePicker`)가 같은 일을 합니다. Chrome·Edge에서
 * 동작하며, 지원하지 않는 브라우저에서는 기존처럼 다운로드 폴더로 내려받습니다.
 */

interface WritableStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileHandle {
  name: string;
  createWritable(): Promise<WritableStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}

type SaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileHandle>;

/** 저장 대화상자를 쓸 수 있는 브라우저인지. */
export function canChooseSaveLocation(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showSaveFilePicker?: SaveFilePicker })
      .showSaveFilePicker === 'function'
  );
}

export interface SaveFileRequest {
  blob: Blob;
  /** 대화상자에 미리 채워질 파일 이름 */
  suggestedName: string;
  /** 형식 설명 (예: "작업 내역 파일") */
  description: string;
  mimeType: string;
  /** 확장자 목록 (예: [".json"]) */
  extensions: string[];
}

export type SaveResult =
  /** 사용자가 고른 위치에 저장함 */
  | { status: 'saved'; fileName: string }
  /** 사용자가 대화상자를 닫음 */
  | { status: 'cancelled' }
  /** 대화상자를 못 쓰는 브라우저라 다운로드 폴더로 내려받음 */
  | { status: 'downloaded'; fileName: string };

/**
 * 파일을 저장합니다. 가능하면 저장 위치를 묻고, 아니면 내려받습니다.
 *
 * 사용자가 대화상자를 닫은 것과 실패는 다릅니다 — 취소했을 때 조용히 다운로드로
 * 넘어가면 원치 않는 파일이 생기므로, 취소는 취소로 돌려줍니다.
 */
export async function saveFile(request: SaveFileRequest): Promise<SaveResult> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: request.suggestedName,
        types: [
          {
            description: request.description,
            accept: { [request.mimeType]: request.extensions },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(request.blob);
      await writable.close();

      return { status: 'saved', fileName: handle.name };
    } catch (e) {
      // 사용자가 창을 닫으면 AbortError가 납니다. 그 밖의 오류는 다운로드로 넘깁니다.
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { status: 'cancelled' };
      }
    }
  }

  downloadBlob(request.blob, request.suggestedName);
  return { status: 'downloaded', fileName: request.suggestedName };
}

/** 브라우저 기본 다운로드. 저장 대화상자를 쓸 수 없을 때의 대비책입니다. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
