import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Next 16.4부터 `next dev`가 저장소 루트에 AGENTS.md를 자동 생성합니다. 이 프로젝트의 지침은
  // `.agents/AGENTS.md`(CLAUDE.md가 불러옴)에 따로 있어서, 켜 두면 개발 서버를 켤 때마다 불필요한
  // 파일이 생겨 작업 트리가 지저분해집니다.
  agentRules: false,
  turbopack: {
    // PDF 다듬이의 qpdf-wasm 이 브라우저용 번들에서도 fs·path 를 import 하는 문장을 갖고 있어서(실행은 안 됨) 빈 모듈로 대체.
    resolveAlias: {
      fs: { browser: "./src/features/pdf-tools/lib/empty-module.ts" },
      path: { browser: "./src/features/pdf-tools/lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
