// qpdf(wasm) — 암호·제한을 풀어 새 PDF를 만듭니다. 브라우저 안에서만 돌아가며 wasm 은 /qpdf 에서 읽습니다.
// 실행할 때마다 새 인스턴스를 씁니다: qpdf 는 끝나면 프로세스처럼 종료해서 같은 인스턴스를 다시 부를 수 없습니다.

import type { QpdfInstance } from "@neslinesli93/qpdf-wasm";

export interface QpdfResult {
  /** qpdf 종료 코드 — 0 성공, 3 경고와 함께 성공, 2 오류 */
  code: number;
  output: Uint8Array | null;
}

async function run(input: ArrayBuffer, args: string[], outPath?: string): Promise<QpdfResult> {
  const create = (await import("@neslinesli93/qpdf-wasm")).default as unknown as (
    opts: Record<string, unknown>,
  ) => Promise<QpdfInstance>;
  const qpdf = await create({
    locateFile: () => "/qpdf/qpdf.wasm",
    // 진행 메시지는 화면에 쓰지 않으므로 버립니다(콘솔이 지저분해지는 것도 막음).
    print: () => {},
    printErr: () => {},
  });
  // 패키지 타입 선언에는 writeFile 이 빠져 있어서 필요한 두 메서드만 직접 적어 둡니다.
  const fs = qpdf.FS as unknown as { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
  fs.writeFile("/in.pdf", new Uint8Array(input));
  let code: number;
  try {
    code = qpdf.callMain(args);
  } catch (err) {
    // Emscripten 은 종료를 예외(ExitStatus)로 알립니다.
    code = (err as { status?: number }).status ?? 2;
  }
  let output: Uint8Array | null = null;
  if (outPath) {
    try {
      output = fs.readFile(outPath);
    } catch {
      output = null;
    }
  }
  return { code, output };
}

/** 암호나 사용 제한(편집·인쇄·복사)이 걸려 있는지. 열기 암호가 필요한 파일은 password 를 함께 줘야 합니다. */
export async function isEncrypted(input: ArrayBuffer, password?: string): Promise<boolean> {
  const pw = password ? [`--password=${password}`] : [];
  return (await run(input, [...pw, "--is-encrypted", "/in.pdf"])).code === 0;
}

/** 암호·제한을 뺀 사본을 만듭니다. 열기 암호가 없는 파일은 password 를 생략합니다. */
export function decrypt(input: ArrayBuffer, password?: string): Promise<QpdfResult> {
  const pw = password ? [`--password=${password}`] : [];
  return run(input, [...pw, "--decrypt", "/in.pdf", "/out.pdf"], "/out.pdf");
}

/** 내용은 그대로 두고 구조만 압축합니다(무손실). 글자·검색·서식이 모두 유지됩니다. */
export async function optimize(input: ArrayBuffer): Promise<Uint8Array> {
  const result = await run(
    input,
    ["--object-streams=generate", "--compress-streams=y", "--recompress-flate", "--compression-level=9", "/in.pdf", "/out.pdf"],
    "/out.pdf",
  );
  if (!result.output || (result.code !== 0 && result.code !== 3)) throw new Error("PDF 구조를 최적화하지 못했습니다.");
  return result.output;
}
