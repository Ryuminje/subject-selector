import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    // PDF 다듬이의 qpdf-wasm 이 브라우저용 번들에서도 fs·path 를 import 하는 문장을 갖고 있어서(실행은 안 됨) 빈 모듈로 대체.
    resolveAlias: {
      fs: { browser: "./src/features/pdf-tools/lib/empty-module.ts" },
      path: { browser: "./src/features/pdf-tools/lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
