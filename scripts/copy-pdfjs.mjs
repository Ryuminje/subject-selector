// pdf.js 워커·글꼴·CMap을 public/pdfjs 로 복사합니다(PDF 다듬이가 같은 서버에서 읽음).
// 외부 CDN을 쓰지 않는 이유: 파일이 서버 밖으로 나가지 않는다는 약속을 코드로 지키기 위해서입니다.
// 라이브러리 버전과 워커 버전이 어긋나면 열리지 않아서 설치 때마다 다시 복사합니다.
import { cpSync, mkdirSync, existsSync } from "node:fs";

const from = "node_modules/pdfjs-dist";
if (!existsSync(from)) process.exit(0);
mkdirSync("public/pdfjs", { recursive: true });
cpSync(`${from}/build/pdf.worker.min.mjs`, "public/pdfjs/pdf.worker.min.mjs");
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(`${from}/${dir}`, `public/pdfjs/${dir}`, { recursive: true });
}

// PDF 암호 제거(qpdf)용 wasm — 같은 이유로 같은 서버에서 읽습니다.
const qpdf = "node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm";
if (existsSync(qpdf)) {
  mkdirSync("public/qpdf", { recursive: true });
  cpSync(qpdf, "public/qpdf/qpdf.wasm");
}
