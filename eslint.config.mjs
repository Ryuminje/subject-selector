import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 우리가 쓴 코드가 아닌 것들 — 점검하면 라이브러리의 압축 코드 때문에 경고 1700여 개가 쏟아져
    // 진짜 문제가 묻힙니다.
    "public/pdfjs/**", // 설치 때 scripts/copy-pdfjs.mjs 가 node_modules 에서 복사해 둔 pdf.js (gitignore 대상)
    "public/qpdf/**", // 같은 방식으로 복사해 둔 qpdf-wasm (gitignore 대상)
    "prototypes/**", // src 에 이식하기 전의 독립 프로토타입 (빌드에 포함되지 않음)
  ]),
]);

export default eslintConfig;
