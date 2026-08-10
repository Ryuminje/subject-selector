# 명신고등학교 업무 도구 모음

학교 업무에 쓰는 웹 프로그램들을 한 곳에 모아둔 허브입니다. Next.js(App Router) 하나에
여러 앱이 `/apps/<이름>` 경로로 들어가 있습니다.

| 부서 | 앱 | 경로 | 로그인 |
|---|---|---|---|
| 교육과정부 | 수강신청 자료 정리 도우미 | `/apps/enrollment-helper` | 없음 |
| 교육평가부 | 시험 시간표 작성 도우미 | `/apps/exam-scheduler` | 없음 |
| 쌤스 헬퍼 | 시간표 교체 도우미 | `/apps/schedule-helper` | 필요 |
| 쌤스 헬퍼 | 연수 이수증 수거 | `/apps/schedule-helper/certificates` | 필요 |
| 쌤스 헬퍼 | 업무 AI 파트너 | `/apps/schedule-helper/assistant` | 필요 |

허브 첫 화면에 나오는 부서·앱 목록은 **`src/config/hub.ts` 한 곳**에서만 관리합니다.
새 앱을 추가할 때는 이 파일의 배열에 항목만 넣으면 되고, 허브 화면 코드는 건드릴 필요가
없습니다.

## 시작하기

```bash
npm install
```

`.env.example`을 `.env.local`로 복사한 뒤 값을 채웁니다. **`DATABASE_URL`이 비어 있으면
개발 서버가 아예 뜨지 않습니다** — 로그인이 필요한 "쌤스 헬퍼" 계열만 실제로 DB를 쓰지만,
프로젝트 전체가 Prisma를 물고 있어서 형식이 맞는 값은 반드시 있어야 합니다. 허브나
수강신청·시험 시간표 도우미만 볼 목적이라면 접속되지 않는 더미 값이어도 됩니다.

```bash
npm run dev
```

http://localhost:3000 에서 확인합니다.

## 자주 쓰는 명령

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 검사
```

## 구조

```
src/
  app/
    page.tsx              # 허브 첫 화면
    apps/<이름>/page.tsx   # 각 앱의 진입점
    api/                  # 서버 라우트 (쌤스 헬퍼 전용)
  config/hub.ts           # 부서·앱 목록 (허브의 유일한 데이터 소스)
  features/<이름>/         # 앱별 내부 구현 (컴포넌트·훅·라이브러리)
  lib/                    # 인증·DB 등 공용 인프라
prisma/schema.prisma      # DB 스키마 (PostgreSQL)
samples/                  # 개발 중 손으로 올려보는 테스트용 엑셀
```

## 더 읽을 것

아키텍처 결정, 앱별 상세 구조, 배포 방식, 과거에 밟은 함정들은
[`.agents/AGENTS.md`](.agents/AGENTS.md)에 정리돼 있습니다. **코드를 고치기 전에 반드시
먼저 읽으세요.**
