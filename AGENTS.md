<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Subject Selector (수강 신청 데이터 처리기) 프로젝트 컨텍스트

이 문서는 다른 PC의 Antigravity 에이전트가 이 프로젝트를 처음 열었을 때, 이전 작업의 문맥과 방향성을 즉시 파악할 수 있도록 돕는 인계장입니다.

## 1. 프로젝트 주요 목적 및 상태
* 학생들의 수강 신청 엑셀 파일을 업로드하면, 교육과정 편제표를 바탕으로 기초/사회/과학/기타 과목을 자동 분류하고, 통계 및 중복/위계 위반 검사를 수행하여 가공된 엑셀 파일로 추출하는 클라이언트 사이드 전용 Next.js 기반 앱.
* 로컬 스토리지 한계로 인해 JSON 백업(.json) 시스템으로 전체 상태를 저장 및 복구.
* 과목의 선/후수 위계(Hierarchy)와 중복 수강 여부를 검사하여 화면과 엑셀에 시각화(노란색/붉은색)함.

## 2. 에이전트 작업 헌법 (Guidelines)
1. **서버 사용 절대 금지**: 교사의 개인정보 및 학생 데이터를 다루므로, 외부 서버(API 라우트, SSR 등)로 데이터가 전송되는 코드를 절대 작성하지 마세요. 오직 브라우저 내부에서만 처리되어야 합니다.
2. 이 파일의 내용은 이 프로젝트의 헌법과 같으므로, 다른 PC에서 작업할 때 항상 이 문맥을 바탕으로 코드를 수정하세요.
