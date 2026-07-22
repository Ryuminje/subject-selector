# AI 에이전트 작업 히스토리 및 규칙 (AGENTS.md)

이 문서는 이전 AI 에이전트들이 작업하며 남긴 중요한 아키텍처 결정사항, 구현 방식, 그리고 향후 개발을 이어갈 에이전트를 위한 가이드라인(Rules)을 담고 있습니다. 새로운 기능을 추가하거나 버그를 수정할 때 반드시 이 문서를 먼저 읽고 기존 시스템의 철학과 규칙을 준수해야 합니다.

---

## 🏠 홈 화면(허브) 라우팅 구조 — 2026-07-20 추가

`/`(`src/app/page.tsx`)는 더 이상 수강신청 정리 도구 자체가 아니라, **학교 업무 도구 전체를 모으는 허브(랜딩) 페이지**입니다. 기존 3탭 도구는 `/apps/enrollment-helper`로 이동했습니다. 앞으로 이 학교에서 쓰는 다른 앱들도 같은 방식으로 이 허브에 합쳐질 예정입니다.

- **`src/app/page.tsx`** (`/`) — 허브 페이지 (client component). 좌우 2단 레이아웃:
  - **왼쪽 부서 pill 목록** (사용자가 대화에서 **"큰 목록"**이라고 부릅니다) — `departments`를 순회하며 부서 하나를 pill 버튼으로 표시. 클릭하면 `activeIndex` state가 바뀌며 오른쪽 패널 내용이 전환됩니다. 색상은 `palette` 배열(amber → rose → emerald → stone 다크 순환)을 부서 인덱스로 자동 매핑합니다.
  - **오른쪽 앱 목록 패널** (사용자가 대화에서 **"작은 목록"**이라고 부릅니다) — 현재 선택된 부서의 헤더(아이콘+이름)와 그 부서 소속 앱들을 카드 목록으로 표시. 카드를 클릭하면 해당 앱의 실제 라우트(`href`)로 이동합니다.
  - DoRms 커뮤니티의 오픈소스 링크트리 템플릿(`dorms-linktree-template`) UI 컨셉(좌측 카테고리 pill → 우측 선택된 카테고리의 링크 목록)을 참고해 자체 구현한 것으로, 템플릿 코드를 그대로 가져오지 않고 이 프로젝트의 크림/앰버 라이트 테마에 맞춰 새로 작성했습니다.
- **`src/config/hub.ts`** — 허브에 표시되는 학교 이름(`schoolName`)·소개 문구(`introText`)·부서 목록(`departments[]`, 각 부서는 `name`/`description`/`icon`/`apps[]`)을 정의하는 단일 데이터 소스입니다. **새 앱이나 부서를 추가할 때는 이 배열에 항목만 추가하면 되고, `src/app/page.tsx`의 렌더링 코드는 건드릴 필요가 없습니다.**
- **`src/app/apps/<slug>/page.tsx`** — 실제 개별 업무 도구. 새 앱을 추가할 때는:
  1. `src/app/apps/<새-slug>/page.tsx`에 라우트를 만들고 (필요하면 `layout.tsx`도 같이 — 아래 참고),
  2. `src/config/hub.ts`의 알맞은 부서 `apps[]`에 `title`/`description`/`href`/`icon`을 등록하세요.
  3. 각 개별 앱 페이지는 상단에 `/`(허브)로 돌아가는 `next/link`를 넣어, 사용자가 다시 허브로 돌아갈 수 있게 하세요 (`enrollment-helper/page.tsx`의 로고 링크, `schedule-helper/page.tsx`의 "허브로 돌아가기" 링크 참고).
  - **`enrollment-helper`** (교육과정부) — 기존 수요조사/선택과목변경/본조사 3탭 도구. 자세한 내부 구조는 바로 아래 "코드 아키텍처 개요" 섹션 참고.
  - **`schedule-helper`** (쌤스 헬퍼) — 별도 저장소(`Ryuminje/Myunshinh-schedule-app`, Next.js)에서 통째로 포팅해온 수업교체/협의회 시간 도우미. 자세한 내용은 아래 "🧩 별도 앱 통합(schedule-helper) 참고 메모" 섹션 참고.

---

## 🏗️ 코드 아키텍처 개요 (2026-07-19 리팩터링 이후 기준, `enrollment-helper` 앱 내부 구조)

`/apps/enrollment-helper`는 서로 다른 세 개의 워크플로우를 하나의 앱에서 탭으로 제공합니다.

| 탭 (사용자 화면) | 컨테이너 파일 | 기능 폴더 |
|---|---|---|
| 수요조사 | `src/components/tabs/DemandSurveyTab.tsx` | `src/features/demand-survey/` |
| 수강신청(본조사) | `src/components/tabs/MainSurveyTab.tsx` | `src/features/main-survey/` |
| 선택과목 변경 | `src/components/tabs/ChangeSurveyTab.tsx` | `src/features/change-survey/` |

**컨테이너 파일**(`src/components/tabs/*.tsx`)은 340~420줄 수준으로, 최상위 UI state(활성 탭/학년 등)와 각 스텝 컴포넌트로의 props 배선(wiring)만 담당하는 순수 컨테이너입니다. state, 비즈니스 로직, JSX 렌더링을 직접 담지 않습니다.

- **`src/features/<feature>/hooks/*.ts`** — state와 핸들러 로직. 예: 교육과정/위계 업로드(`use*Curriculum`), 원본 파일 업로드·파싱(`use*Uploads`), 선택과목 변경/최적화 알고리즘(`useElectiveChanges`), 반편성·교과군별 시수 정리 및 엑셀 export(`use*ClassSummary`, `useChangeExports`) 등.
- **`src/features/<feature>/components/*Step.tsx`** — 각 단계(1~8단계)의 JSX 렌더링. 컨테이너는 `activeTab === "..."` 조건에 따라 해당 스텝 컴포넌트에 필요한 props를 넘겨줄 뿐입니다.

**새 기능을 추가하거나 버그를 수정할 때:**
- 컨테이너 파일에 직접 `useState`나 JSX를 다시 추가하지 마세요. 관련 있는 훅 파일을 찾아 그 안에서 state/로직을 수정하고, 렌더링은 해당 스텝 컴포넌트에서 수정하세요.
- `main-survey`와 `demand-survey`는 구조가 거의 동일하지만 세부 로직이 다른 곳이 있습니다:
  - 교육과정 파싱(`useMainCurriculum` / `useDemandCurriculum`)은 완전히 동일한 로직이라 `useDemandCurriculum`이 `useMainCurriculum`을 그대로 재-export합니다.
  - 업로드 파싱(`useMainUploads` / `useDemandUploads`)은 실제로 다릅니다 — 본조사는 매트릭스형(`그룹::과목` 헤더 조합), 수요조사는 콤마 구분형 응답을 파싱합니다.
  - 두 폴더(`main-survey` ↔ `demand-survey`) 사이에서 코드를 옮기거나 재사용하기 전에 반드시 diff로 실제 차이를 먼저 확인하세요. 무분별한 복사·붙여넣기 금지.
- **`MainSurveyTab`(본조사)은 `DemandSurveyTab`(수요조사)을 복사해서 만들다가 아직 개발이 덜 끝난 상태**입니다. 예를 들어 "엑셀 입력 예시" 모달은 수요조사 쪽엔 실제로 렌더링되지만(`ExampleModal` 컴포넌트), 본조사 쪽은 버튼과 `isExampleModalOpen` state만 있고 모달 자체가 없습니다. 이는 알려진 미완성 상태이지 버그가 아닙니다 — 본조사 기능을 완성할 때 수요조사 쪽 구현을 참고해서 이식하세요.

---

## 🧩 별도 앱 통합(schedule-helper) 참고 메모 — 2026-07-20 추가

`/apps/schedule-helper`("쌤스 헬퍼" 부서의 "시간표 교체 도우미")는 이 프로젝트에서 새로 만든 게 아니라, **별도 GitHub 저장소(`Ryuminje/Myunshinh-schedule-app`, 이미 Vercel에 독립 배포되어 있던 Next.js 프로젝트)의 소스를 통째로 이 레포 안으로 포팅**한 것입니다. 앞으로 비슷하게 "다른 저장소의 앱을 이 허브에 합쳐달라"는 요청이 오면 이때 쓴 방식을 그대로 따르세요.

- **파일 매핑:** 원본의 `src/lib/*` → `src/features/schedule-helper/lib/*`, 원본의 `src/components/*Tab.tsx` → `src/features/schedule-helper/components/*Tab.tsx`, 원본의 `src/app/page.tsx` → `src/app/apps/schedule-helper/page.tsx`, 원본의 `src/app/layout.tsx` → `src/app/apps/schedule-helper/layout.tsx`(단, 원본의 `<html>/<body>`는 제거하고 루트 레이아웃 안에 중첩되는 일반 래퍼 `<div>` + `<ScheduleProvider>`로 변경 — App Router에서 `<html>/<body>`는 루트 레이아웃에만 있어야 합니다), 원본의 `src/app/api/schedule/route.ts`는 **경로 그대로** `src/app/api/schedule/route.ts`로 이식(허브 프로젝트에 기존 `/api/*` 라우트가 없어서 충돌이 없었고, 클라이언트 코드의 `fetch('/api/schedule')` 호출을 고칠 필요가 없었습니다).
- **의존성:** 원본 `package.json`을 그대로 베끼지 말고 **실제로 import되는 것만** 이식하세요. `clsx`/`tailwind-merge`(→ `cn` 헬퍼)는 실제로 쓰여서 추가했지만, 원본 `package.json`에 있던 `papaparse`는 소스 어디에도 import가 없는 죽은 의존성이라 설치하지 않았습니다.
- **데이터 소스 (2026-07-21 이후):** ~~구글 시트 export URL을 fetch~~하던 방식은 폐기했습니다. 지금은 관리자가 앱 안에서 직접 엑셀을 업로드하고, 그 결과가 DB(`School.scheduleData`)에 저장됩니다. 자세한 내용은 바로 아래 "🏫 schedule-helper 멀티테넌트(학교별 계정) 아키텍처" 섹션을 보세요 — `sheetData.ts`는 이제 `parseScheduleWorkbook(buffer)`라는 순수 파싱 함수만 남았고, fetch/URL 관련 코드는 전혀 없습니다.
- **원본에 있던 실제 버그 2개를 포팅 중에 고쳤습니다** (원본 저장소에는 아직 남아있을 수 있음):
  1. `MeetingTab.tsx`가 `if (!data) return null;` 조건부 return **뒤에** `useMemo`를 호출하고 있어 React 훅 규칙 위반이었습니다 — `useMemo` 호출을 조건부 return보다 앞으로 옮기고 콜백 내부에서 `!data` 체크를 하도록 수정했습니다.
  2. `ScheduleContext.tsx`가 `sheetData.ts`의 `fetchScheduleData`를 import만 하고 실제로는 안 쓰고 있었습니다(대신 `/api/schedule`을 직접 fetch) — 죽은 import라 제거했습니다.
  - 이 프로젝트의 eslint 설정(`react-hooks` 최신 규칙 포함)이 원본보다 엄격해서 이 두 개 외에 `react/no-unescaped-entities`(따옴표 이스케이프)와 `react-hooks/set-state-in-effect`(localStorage를 마운트 이펙트에서 읽어와 setState하는, SSR 안전을 위해 의도된 패턴 — `eslint-disable-next-line` 처리)도 걸렸습니다. 새 외부 코드를 포팅할 때는 항상 `npx tsc --noEmit`과 `npx eslint <새 경로>`를 새로 추가한 파일에 한정해서 돌려보고 이 프로젝트 기준으로 깨끗하게 맞추세요.
- **UI 톤:** 원본의 emerald/teal 포인트 컬러를 그대로 유지했습니다(이미 라이트 테마라 허브의 크림/앰버 톤과 크게 부딪히지 않음). 상단에 "허브로 돌아가기" 링크(`next/link` → `/`)만 추가했습니다.

---

## 🏫 schedule-helper 멀티테넌트(학교별 계정) 아키텍처 — 2026-07-21 추가

`schedule-helper`("쌤스 헬퍼")는 원래 명신고 전용으로 구글 시트 하나를 fetch하는 단일 학교 도구였는데, **여러 학교가 각자 가입해서 자기 데이터로 쓸 수 있는 서비스**로 확장했습니다. 이 프로젝트에서 로그인/DB가 있는 유일한 부분이 여기입니다 — 허브, `enrollment-helper`는 지금도 인증 없이 완전히 열려 있습니다.

### 스택 선택

- **DB: Prisma + PostgreSQL** (`@prisma/adapter-pg` 드라이버 어댑터 사용). **처음엔 SQLite(`@prisma/adapter-better-sqlite3`)로 만들었다가 2026-07-21에 Postgres로 다시 바꿨습니다** — 앱을 Vercel(서버리스)에 올리려는데 SQLite는 파일 기반이라 서버리스 환경(읽기 전용 파일시스템, 요청마다 다른 인스턴스일 수 있음)에서 영속성이 없어 근본적으로 안 맞았기 때문입니다. Postgres 서버 자체는 **NAS에 Docker로 띄워두고**(`~/docker/subject-selector-db/docker-compose.yml`, `postgres:16-alpine`), 라우터에서 TCP 포트(NAS 내부 `55432`)를 포워딩해서 Vercel에서도 접근하게 했습니다. 즉 "앱은 Vercel, DB는 자기 NAS" 하이브리드 구조입니다. 자세한 내용은 아래 "🌐 배포 아키텍처" 섹션 참고.
  - **Prisma 7 문법 주의:** 이 버전은 `generator client { provider = "prisma-client" }` (구버전 `prisma-client-js` 아님)를 쓰고, 생성된 클라이언트를 `src/generated/prisma`에 출력합니다(스키마 파일의 `output` 참고, `.gitignore`에 이미 등록됨). **드라이버 어댑터가 필수**라 `new PrismaClient()`를 인자 없이 호출하면 타입 에러가 납니다 — 반드시 `new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) })` 형태로 써야 합니다(`src/lib/prisma.ts` 참고). SQLite였을 때는 `new PrismaBetterSqlite3({ url })`이었는데 어댑터 생성자 시그니처가 provider마다 다르니 다른 DB로 또 바꿀 일이 있으면 해당 adapter 패키지의 타입 정의부터 확인하세요.
  - **`src/generated/prisma`는 `.gitignore`되어 있어 저장소에 커밋되지 않습니다.** Vercel/NAS 어디서든 빌드 시 `npx prisma generate`가 먼저 실행되어야 하는데, `package.json`의 `"postinstall": "prisma generate"`가 이를 자동으로 처리합니다 — **이 스크립트를 지우면 배포가 `Module not found: Can't resolve '@/generated/prisma/client'`로 즉시 깨집니다.** (2026-07-21, Vercel 첫 배포 실패 원인이 정확히 이거였습니다.)
  - 스키마/마이그레이션 CLI는 `.env`가 아니라 `prisma.config.ts`(및 그 안에서 로드하는 `.env`)를 봅니다. `npx prisma migrate dev`, `npx prisma generate`로 스키마를 바꿀 때마다 클라이언트를 재생성해야 합니다.
- **인증: better-auth** (NextAuth/Auth.js 아님). 처음엔 NextAuth v5를 쓰려 했지만, 이 시점 기준 NextAuth v5가 여전히 beta(5.0.0-beta.31)에 머물러 있고 better-auth는 안정 버전(1.6.x)까지 나와 있어 전환했습니다. `npx auth ...` CLI 명령은 better-auth의 CLI입니다(패키지명이 `auth`라 헷갈리기 쉬움 — NextAuth의 것이 아닙니다).
  - `src/lib/auth.ts` — `betterAuth()` 설정. `prismaAdapter(prisma, { provider: "sqlite" })`, `emailAndPassword: { enabled: true }`, 그리고 `user.additionalFields`로 `role`("ADMIN"|"TEACHER" 문자열 — better-auth의 additionalFields는 Prisma enum을 지원하지 않아 일반 string으로 관리)/`schoolId`/`teacherId`를 계정에 붙였습니다. `plugins: [nextCookies()]`가 **반드시 마지막 플러그인**이어야 하며, 이게 있어야 `auth.api.*` 호출 시 Next.js Route Handler/Proxy 안에서 세션 쿠키가 자동으로 설정됩니다.
  - `src/lib/auth-client.ts` — 브라우저에서 쓰는 `better-auth/react` 클라이언트. `signIn`/`signOut`/`useSession`만 export — 회원가입은 클라이언트에서 직접 `authClient.signUp.email()`을 호출하지 않고, 아래 커스텀 API 라우트가 서버에서 `auth.api.signUpEmail(...)`을 호출하는 방식입니다(가입 시점에 `role`/`schoolId`를 서버가 결정해야 하기 때문 — "학교 만들기"면 ADMIN+새 School, "코드로 가입"이면 TEACHER+기존 School).
  - `src/app/api/auth/[...all]/route.ts` — better-auth의 모든 내장 엔드포인트(`/api/auth/sign-in/email`, `/get-session`, `/sign-out` 등)를 처리하는 catch-all. `toNextJsHandler(auth)`로 한 줄이면 충분합니다.

### 데이터 모델 (`prisma/schema.prisma`)

- **`School`** — 테넌트 하나. `joinCode`(교사 셀프 가입용, 8자리), `scheduleData`(JSON 문자열 — 업로드된 시간표의 `{teachers, days, periods, tableData}`), `scheduleUploadedAt`, `globalMeetingBlocks`(JSON, 전체 교사 공통 협의회 불가 시간).
- **`Teacher`** — 학교 안의 교사 한 명. **로그인 계정 유무와 무관하게 존재**하며 시간표 업로드 시 이름으로 자동 upsert됩니다(`@@unique([schoolId, name])`). `department`(교과군), `fixedBlockDays`(관리자가 지정하는 고정 교체불가, JSON), `tempBlockDays`(오늘 결근 등 임시 교체불가, 학교 전체 공유, JSON) — 이 셋은 예전엔 엑셀의 "설정" 시트 + 브라우저 localStorage에서 왔지만, 지금은 전부 "교사 목록 관리" 화면(`/apps/schedule-helper/teachers`, 관리자 전용)에서 직접 편집합니다.
- **better-auth가 자동 생성/관리하는 `User`/`Session`/`Account`/`Verification`** — `npx auth generate`가 스키마 파일에 직접 써넣은 모델입니다. **이 네 모델은 손으로 편집하지 말고 항상 `npx auth generate`로 재생성하세요** — CLI가 이 블록을 통째로 다시 쓰기 때문에, 수동으로 추가한 `@relation` 같은 필드는 다음 `generate` 때 사라질 수 있습니다. 그래서 의도적으로 `User.schoolId`/`User.teacherId`는 Prisma `@relation` 없이 평범한 문자열 필드로만 두었고, 관련 School/Teacher를 찾을 땐 그냥 `prisma.school.findUnique({ where: { id: user.schoolId } })`처럼 수동 조회합니다.

### 라우팅 & 인증 게이트

- `src/app/apps/schedule-helper/(app)/` — **route group**. `layout.tsx`(폰트 + `<ScheduleProvider>`)와 기존 `page.tsx`, `teachers/page.tsx`가 여기 있습니다. `(app)`는 URL에 나타나지 않으므로 여전히 `/apps/schedule-helper`, `/apps/schedule-helper/teachers`로 접근합니다.
- `src/app/apps/schedule-helper/login/page.tsx`, `signup/page.tsx` — **`(app)` 밖에** 있습니다. 로그인 전 페이지에서 `ScheduleProvider`가 불필요한 `/api/schedule` 요청을 쏘지 않게 하려는 의도적인 분리입니다.
- **`src/proxy.ts`** (Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었고 **기본적으로 Node.js 런타임에서 실행**됩니다 — SQLite였을 때는 better-sqlite3 네이티브 모듈 때문에 Edge 런타임이었다면 애초에 동작하지 않았을 결정적인 이유였고, Postgres로 바꾼 지금도(`pg`는 순수 JS라 Edge에서도 돌아갈 수 있음) Prisma 클라이언트 자체가 Node API에 기대는 부분이 있어 Node 런타임을 유지하는 게 안전합니다). `/apps/schedule-helper/:path*`를 매칭해서 `login`/`signup` 경로를 제외한 나머지에 세션이 없으면 로그인 페이지로 리다이렉트합니다. 허브·`enrollment-helper`는 이 matcher에 안 걸리므로 영향 없습니다.
- 가입 흐름: "학교 만들기"(`POST /api/schedule-helper/schools` — School 생성 + joinCode 발급 + admin 계정 생성, 이메일 중복 등으로 계정 생성이 실패하면 방금 만든 School을 롤백 삭제) / "코드로 가입"(`POST /api/schedule-helper/join` — joinCode로 School을 찾아 TEACHER 계정 생성). 둘 다 `src/app/apps/schedule-helper/signup/page.tsx`의 탭 토글 UI에서 호출합니다.

### 데이터 흐름 요약

1. 관리자가 `/apps/schedule-helper`에서 "시간표 업로드"로 엑셀을 올리면 → `POST /api/schedule-helper/upload`가 `parseScheduleWorkbook()`으로 파싱 → `School.scheduleData`에 저장 + 파싱된 교사 이름들을 `Teacher`로 upsert.
2. `GET /api/schedule`가 로그인 세션의 `schoolId`로 `School` + `Teacher[]`를 조회해서, 예전 `ScheduleData` 모양(`teachers/days/periods/tableData/defaultBlockSettings/tempBlockSettings/globalMeetingBlocks/teacherDepts`)으로 조립해 반환합니다. `defaultBlockSettings`/`teacherDepts`는 `Teacher.fixedBlockDays`/`.department`에서, `tempBlockSettings`는 `Teacher.tempBlockDays`에서 옵니다.
3. 관리자가 "교사 목록 관리"(`/apps/schedule-helper/teachers`)에서 교사별 `department`/`fixedBlockDays`를 저장하면 `PATCH /api/schedule-helper/teachers/[id]`가 해당 `Teacher` 행만 갱신합니다(관리자 본인 학교 소속인지 반드시 확인 — `teacher.schoolId !== session.user.schoolId`면 404).
4. 교체 불가 탭에서 "오늘 결근" 같은 임시 설정을 추가/삭제하면 `POST`/`DELETE /api/schedule/blocks`가 `Teacher.tempBlockDays`를 직접 수정합니다 — **더 이상 브라우저 localStorage가 아니라 학교 전체가 공유하는 서버 데이터**입니다(예전엔 `schedule_local_blocks`라는 키로 각자 브라우저에만 저장됐었음).

### 새 학교가 이 서비스를 쓰려면 (온보딩)

1. 관리자가 `/apps/schedule-helper/signup`에서 "학교 만들기"로 가입 → joinCode 발급받음(관리자에게만 한 번 보여줌, 잊어버리면 현재는 재발급 기능이 없으니 필요해지면 추가하세요).
2. 관리자가 학기별 전체 교사 시간표 엑셀(순번/교사성명 열 + 월~금 요일·교시 헤더 + "학년 과목명(반)" 형태 셀 — `sheetData.ts`의 `parseScheduleWorkbook` 참고)을 업로드.
3. joinCode를 다른 선생님들께 공유 → 각자 "코드로 가입"으로 셀프 가입.
4. (선택) 관리자가 "교사 목록 관리"에서 교과군/고정 교체불가 시간을 채워넣음.

### 배포 시 주의

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` 세 환경변수가 반드시 필요합니다(`.env.example` 참고). `BETTER_AUTH_SECRET`은 `npx auth secret`으로 생성. **로컬 개발용과 배포(Vercel/NAS)용 값은 반드시 분리**하세요 — 로컬 `.env`를 그대로 배포 환경에 재사용하지 마세요.
- 배포 파이프라인에 `npx prisma migrate deploy`(dev 전용인 `migrate dev` 아님)를 빌드/배포 스텝에 추가해야 마이그레이션이 실제 서버에도 적용됩니다. NAS Docker 배포는 `Dockerfile`의 `CMD`에서 자동으로 실행하지만, Vercel은 아직 반영 안 되어 있으니 스키마를 바꿀 때마다 NAS Postgres에 직접 `npx prisma migrate deploy`(또는 로컬에서 `migrate dev`, 어차피 DATABASE_URL이 NAS를 가리키므로 결과는 같음)를 실행해야 합니다.
- **`package.json`의 `postinstall: "prisma generate"`를 절대 지우지 마세요** — `src/generated/prisma`가 `.gitignore`되어 있어서, 이게 없으면 어떤 배포 환경에서든 첫 빌드부터 `Module not found` 에러로 깨집니다.
- 실제 배포 아키텍처(앱은 어디, DB는 어디, 왜 이렇게 나눴는지)는 바로 아래 "🌐 배포 아키텍처" 섹션을 보세요.

---

## 🌐 배포 아키텍처 — 2026-07-21 확정

**앱(Next.js)은 Vercel, DB(Postgres)는 자기 소유 NAS.** 앱을 매번 NAS에 수동 배포(`deploy.sh`)하는 대신 GitHub `main` 푸시 시 Vercel이 자동 빌드/배포하도록 하고, 그 대신 이미 갖고 있는 NAS 저장공간(7TB+)을 DB 호스팅에 씁니다. Turso/Neon 같은 유료/제3자 DB 서비스를 새로 계약하지 않아도 되는 게 장점입니다.

### Vercel (앱)

- 프로젝트: `minje88/subject-selector` (Vercel 계정 `fbalswp-1880`, 팀 `minje88`). GitHub `Ryuminje/subject-selector`의 `main` 브랜치와 연결되어 있어 푸시할 때마다 자동 재배포됩니다.
- **실제 프로덕션 URL은 `https://subject-selector.vercel.app`** (짧은 alias). `npx vercel ls` / `npx vercel project ls`가 보여주는 `https://subject-selector-*-minje88.vercel.app` 형태의 URL은 **배포 하나하나에 대한 고유 URL**이고 Vercel의 Deployment Protection이 걸려 있어 브라우저로 열면 Vercel 로그인 화면으로 리다이렉트됩니다 — 이건 배포 실패가 아니라 정상 동작이니, 실제 서비스 상태를 확인할 땐 항상 짧은 alias(`subject-selector.vercel.app`)로 열어보세요. `BETTER_AUTH_URL` 등 앱이 자기 자신을 가리켜야 하는 환경변수도 반드시 이 alias를 써야 합니다.
- 로컬에서 이 프로젝트를 다루려면 `npx vercel link --project subject-selector --yes`로 연결(이미 연결되어 있으면 스킵됨, `.vercel/` 생김 — gitignore됨). CLI는 첫 실행 시 디바이스 인증 플로우로 로그인을 요구합니다.
- 환경변수는 `echo -n "값" | npx vercel env add KEY production` 형태로 추가합니다(대화형 프롬프트라 값을 stdin으로 흘려보내야 함). `npx vercel env ls`로 확인.
- 배포 로그/상태 확인: `npx vercel ls`(최근 배포 목록과 상태), `npx vercel inspect <deployment-url> --logs`(특정 배포의 빌드 로그 전체).
- **첫 Vercel 배포가 실패했던 이유**: `src/generated/prisma`가 gitignore되어 있는데 `postinstall` 스크립트가 없어서 빌드 시 Prisma client가 아예 생성되지 않았음 — 위 "postinstall" 관련 경고 참고.

### NAS (DB만)

- Postgres는 `~/docker/subject-selector-db/docker-compose.yml`(`postgres:16-alpine`)로 별도 컨테이너로 띄워져 있습니다. **NAS 전체 앱(`~/docker/my-webapp/`, `Dockerfile`/`docker-compose.yml`/`deploy.sh`)은 2026-07-21부로 잠정 중단 상태** — 코드는 남아있지만 실제로 그 경로에 최신 앱을 배포해서 쓰고 있진 않습니다. 나중에 다시 쓰게 되면 NAS 앱과 NAS DB가 같은 머신에 있으니 `DATABASE_URL`을 `postgresql://...@192.168.0.21:55432/...`처럼 로컬 LAN IP로 바로 잡으면 되고, 외부 도메인/포트포워딩은 필요 없습니다.
- **포트 포워딩**: 라우터에서 외부 TCP `55432` → `192.168.0.21:55432`. 도메인은 DuckDNS(`fbalswp.duckdns.org`)를 씁니다. Vercel의 `DATABASE_URL`은 이 외부 주소(`fbalswp.duckdns.org:55432`)를 가리키고, **로컬 개발 환경의 `DATABASE_URL`은 같은 LAN이므로 포트포워딩을 거치지 않고 `192.168.0.21:55432`로 직접 접속**합니다 — 두 값이 다른 게 정상입니다.
- DB 비밀번호는 `openssl rand -hex 20`으로 생성했고, NAS의 `docker-compose.yml`(POSTGRES_PASSWORD)과 로컬 `.env`, Vercel의 `DATABASE_URL` 세 곳에 각각 반영되어 있어야 동기화가 맞습니다. 바꿀 일이 있으면 이 세 곳을 다 갱신하세요.
- 데이터 영속화: `~/docker/subject-selector-db/data`가 Postgres의 실제 데이터 디렉토리(볼륨 마운트) — 컨테이너를 지우고 다시 만들어도 이 폴더만 살아있으면 데이터는 유지됩니다.

### NAS SSH 작업 시 알아둘 것

- `fbalswp` 계정을 NAS의 `docker` 그룹에 넣어뒀습니다(`sudo usermod -aG docker fbalswp`, 이미 완료) — 이제 `sudo` 없이 `docker`/`docker compose` 명령을 바로 쓸 수 있습니다. **`sudo`가 필요한 새 작업이 생기면 비밀번호를 대화형으로 입력해야 해서 자동화가 막힙니다** — 가능하면 `docker` 그룹 권한만으로 되는 방식을 우선 찾아보세요.
- 이 프로젝트 환경(Windows + Git Bash)에는 **`rsync`가 없습니다** — `deploy.sh`는 rsync 기반이라 Windows에서 직접 실행하면 즉시 실패합니다. 대신 `tar`로 압축해서 `scp`로 옮기는 방식을 씁니다:
  ```bash
  tar --exclude=node_modules --exclude=.git --exclude=.next --exclude=src/generated \
      --exclude=".env*" --exclude=dev.db --exclude=data \
      -czf /c/path/to/scratchpad/deploy.tar.gz .
  scp -O deploy.tar.gz fbalswp@192.168.0.21:/home/fbalswp/docker/my-webapp/deploy.tar.gz
  ssh fbalswp@192.168.0.21 "cd ~/docker/my-webapp && tar -xzf deploy.tar.gz && rm deploy.tar.gz"
  ```
  **`scp`에 반드시 `-O` 플래그를 붙이세요** — Windows OpenSSH의 최신 SFTP 기반 scp가 이 NAS의 sshd와 안 맞아 `dest open ... No such file or directory`로 조용히 실패합니다. `-O`는 예전 SCP 프로토콜을 강제해서 문제를 피합니다. tar 압축 시 대상 경로는 반드시 POSIX 스타일(`/c/Users/...`)로 써야 합니다 — Windows 스타일(`C:\Users\...`)을 주면 tar가 콜론(`:`)을 `host:path` 원격 접속 문법으로 오인해서 엉뚱한 에러(`Cannot connect to C`)를 냅니다.

---

## 📜 연수 이수증 수거(certificates) 참고 메모 — 2026-07-22 추가

`/apps/schedule-helper/certificates`("연수 이수증 수거")는 사용자가 별도로 운영하던 Google Apps Script 앱("교원 연수 이수증 제출 자동화 시스템", Sheets/Drive/PropertiesService 기반)을 schedule-helper의 서브 메뉴로 이식한 것입니다. Google 의존성은 전부 걷어내고 기존 NAS Postgres로 통합했습니다. 허브 카드(`src/config/hub.ts`)와 `(app)/page.tsx`가 아닌 독립 라우트로 진입하며, `certificates/layout.tsx`는 폰트만 감싸고 `ScheduleProvider`를 쓰지 않습니다(시간표 데이터와 무관한 기능이라 무거운 `/api/schedule` fetch를 피함).

- **4개 기능과 접근 범위**: 제출하기(로그인 전원, 본인 이름은 `resolveTeacherName(session.user)`로 서버가 강제 — 클라이언트가 이름을 자유 입력할 수 없어 스푸핑 불가) / 내역조회(관리자는 전체 검색, 일반 교사는 본인 것만 강제 필터) / 일괄확인(관리자 또는 해당 연수의 등록자만, 아래 `TrainingTitle` 참고) / 서명받기 QR(원본 그대로 **완전 익명** 유지 — 세션 cuid 자체가 유일한 접근 통제라는 트레이드오프를 사용자가 명시적으로 승인함).
- **`resolveTeacherName(user)`** (`src/features/schedule-helper/lib/resolveTeacherName.ts`) — `user.teacherId`가 있으면 그 `Teacher.name`, 없으면 `user.name` 폴백. 제출/내역조회/일괄확인/연수삭제 전부 이 헬퍼로 신원을 서버에서 재확인하고, 클라이언트가 보낸 이름은 절대 신뢰하지 않습니다.
- **`TrainingTitle` 레지스트리**: "연수 제목"은 자유 텍스트가 아니라 사전 등록제입니다. 로그인한 아무나 새 연수를 등록할 수 있고(`POST /api/schedule-helper/certificates/training-titles`, `@@unique([schoolId, title])`), 등록된 연수는 전 교사가 제출 가능(`submit`이 등록 여부를 검사, 미등록 연수 제출 시 400)합니다. **일괄확인 조회와 삭제는 관리자 또는 그 연수를 등록한 본인(`registeredByName`)만 가능**(`DELETE /api/schedule-helper/certificates/training-titles/[id]`) — 다른 교사가 등록한 연수의 제출 현황을 남이 못 보게 하려는 의도입니다. `TrainingTitleSelect.tsx`가 원본 앱의 드롭다운 UX(제목 검색 + 미존재시 "새 연수로 등록" 인라인 버튼)를 재현합니다.
- **파일/서명 저장**: `TrainingCertificate.fileBytes`, `SignSessionSignature.signaturePng` 모두 Prisma `Bytes`(Postgres `bytea`)로 행에 직접 저장, 별도 오브젝트 스토리지 없음. 스트리밍 라우트(`[id]/file`, `signatures/[id]/image`)는 `NextResponse`에 raw `Buffer` 바디 + `Content-Type`/`Content-Disposition: inline` 헤더. **`Cache-Control`은 반드시 `private, no-cache`** — 한 번 `max-age=31536000, immutable`로 뒀다가, 같은 브라우저 탭에서 로그아웃 후 다른 교사로 로그인하면 브라우저 캐시가 이전 교사의 파일을 그대로 서빙하는 실제 위험을 발견해 고쳤습니다. 새로운 bytea 스트리밍 라우트를 추가할 때 이 캐시 헤더를 그대로 복사하세요.
- **Gemini API 키**: 개발자 env var가 아니라 `School.geminiApiKey`(평문, `joinCode`와 동일한 신뢰 수준)에 학교 관리자가 직접 등록(`gemini-key` GET/PATCH, admin-only). `lib/gemini.ts`의 `analyzeCertificateImage`는 순수 `fetch` 기반 Gemini 2.5 Flash 호출이고, 실패해도 제출 자체를 막지 않고 `extractionFailed: true`로 수동 입력 폴백을 유도합니다.
- **QR 서명(`SignSession`/`SignSessionSignature`) 익명 라우트**: `sessions/[id]` GET과 `sessions/[id]/sign` POST는 로그인 검사가 **의도적으로 없습니다** — QR/URL을 아는 사람이면 누구나 로스터의 이름으로 서명 가능한, 원본 앱과 동일한 트레이드오프입니다. `src/proxy.ts`의 `PUBLIC_PATHS`에 `/apps/schedule-helper/certificates/sign`이 등록되어 있어야 이 페이지가 로그인 리다이렉트를 안 탑니다 — 나중에 "로그인 요구"로 되돌리는 방향의 수정은 이 설계를 깨는 것이니 하지 마세요. 한 사람의 서명은 세션의 모든 연수 제목에 동시에 적용됩니다(그룹 서명 1회 = 여러 연수 동시 서명 처리, `SignSessionSignature`엔 `trainingTitle` 필드가 없음 — 원래 있었다가 원본 앱의 실제 동작(`Code.gs`의 `submitSignature`가 그룹의 모든 연수 시트에 동일 서명을 씀)을 재확인하고 스키마에서 제거).
- **스키마**: `School.geminiApiKey`, `TrainingTitle`(`id/schoolId/title/registeredByName/createdAt`), `TrainingCertificate`(`teacherName/trainingTitle/number/institution/certDate/fileName/mimeType/fileBytes`), `SignSession`(`trainingTitles`/`rosterSnapshot`는 JSON string[], `locked`), `SignSessionSignature`(`sessionId+teacherName` unique), `CertificateRosterExtra`(아래 항목 참고). 관련 마이그레이션 4개: `add_training_certificates`, `simplify_sign_session_signature`(그룹서명 스키마 교정), `add_training_title_registry`, `add_certificate_roster_extra`.
- **`CertificateRosterExtra` — 시간표에 없는 인원 보충 명단 (2026-07-22 추가)**: 일괄확인/서명 세션의 "전체 대상자" 명단은 원래 `Teacher` 테이블(=시간표 업로드 시 자동 upsert된 이름)만 봤는데, 행정직원처럼 애초에 시간표가 없는 사람을 넣을 방법이 없다는 문제가 나와서 추가했습니다. `Teacher` 테이블에 직접 끼워 넣는 대신 **완전히 별도의 명단**으로 분리한 이유: 시간표 교체 도우미(SwapTab)의 교사 목록은 `Teacher` 테이블이 아니라 `School.scheduleData.teachers`(파싱된 시간표 JSON)를 기준으로 하므로, `Teacher`에 시간표 없는 사람을 추가해도 스왑 화면에는 안 나타나 실질적으로는 안전하지만, 사용자가 "연수 이수증 기능 전용 별도 명단"을 명시적으로 선택했습니다(교사 목록 관리 화면에 뒤섞이지 않게). `src/features/schedule-helper/lib/getCertificateRoster.ts`가 `Teacher.name`과 `CertificateRosterExtra.name`을 합쳐 정렬된 전체 명단을 반환하는 단일 창구 — 새로운 "전체 대상자" 조회가 필요해지면 `prisma.teacher.findMany`를 직접 쓰지 말고 이 헬퍼를 재사용하세요. 관리 UI는 `ExtraRosterSettings.tsx`(관리자 전용, `BulkCheckTab.tsx` 상단에 렌더링) — 추가/삭제 모두 admin-only, `Teacher`/기존 `CertificateRosterExtra`와 이름이 겹치면 400.

---

## 🛠️ 주요 구현 히스토리 (기능별)

**1단계: 기초 자료 입력 (교육과정 및 위계)**
- `activeGrade`와 `changeActiveGrade` 상태를 분리하여 수요조사 탭과 선택과목 변경 탭 간의 학년 상태 간섭을 원천 차단했습니다.
- 예비 1, 2학년과 3학년의 과목군(기초, 사회, 과학 등) 체계가 다름을 인지하고, 이를 하드코딩하지 않고 업로드된 엑셀 파싱 로직에 의존하도록 구현했습니다.

**2단계: 2학기 타임별 선택과목 데이터 업로드**
- VLOOKUP 등의 엑셀 함수가 포함된 파일을 업로드해도 값이 정상적으로 파싱될 수 있도록 `xlsx` 라이브러리의 파서를 고도화했습니다.
- 에러 발생 시 사용자에게 친절한 모달(Modal) 창을 띄워 어떤 학년/학번에서 파싱 오류가 발생했는지 명확하게 피드백을 주도록 에러 핸들링을 구축했습니다.

**3단계: 타임별 시간표 입력**
- 각 타임(A, B, C 등)별로 어떤 과목이 개설되었는지 사용자가 직접 드롭다운으로 선택할 수 있는 Matrix 형태의 UI를 구축했습니다.
- **엑셀 다중 붙여넣기(Interleaved Format) 감지:** 엑셀에서 과목명과 교사명이 교대로 배치된 영역을 복사하여 붙여넣을 때, 행 수가 남은 타임 수의 2배 이상이면 홀수행은 과목명, 짝수행은 교사명으로 자동 인식하여 한 번에 모두 입력되도록 편의성을 대폭 개선했습니다.

**4단계: 타임별 선택과목 명단 및 5단계: 선택과목 변경 신청 (교환 로직)**
- **4단계 뷰 정규식 버그 수정:** 동적으로 생성된 코드에서 정규식 백슬래시(`\`)가 이중 이스케이프(`\\d`)되어 과목-학생 매칭이 실패하던 버그를 찾아 수정함으로써 4단계 타임별 학생 명단이 정상적으로 출력되도록 버그를 해결했습니다.
- **핵심 알고리즘:** 학생이 변경을 희망하는 과목(`targetSubject`)과 포기해야 하는 과목(`dropSubject`)을 교환(Swap)할 수 있는지 탐색합니다.
- 단순한 1:1 교환이 아닌, `Time A`에 있는 과목을 `Time C`로 옮기고, `Time C`에 있던 과목을 `Time B`로 옮기는 등 빈 틈(Slot)을 찾아내는 연쇄적인 탐색 로직(Depth-First Search 방식의 배열 탐색)이 포함되어 있습니다.

**6단계: 변경 후 명단 및 7단계: 다년도 분석 (Hill Climbing 알고리즘)**
- **4단계 타임별 학생 명단 뷰 고도화:** 6단계에 있던 과목별 필터링 기능(전체 과목/특정 과목 선택)을 4단계에도 동일하게 적용하여 특정 과목의 수강 명단만 빠르게 확인할 수 있도록 개선했습니다.
- **버그 수정 (중복 변경 에러):** 최적화 알고리즘이 내부적으로 미래 예측 방어 로직(Lookahead)과 충돌하여 1번의 교환을 2개의 변경 기록으로 생성해 (불가) 로그를 띄우던 문제를 해결했습니다.

**8단계: 리로스쿨 업로드용 최종 엑셀 다운로드**
- 2단계에서 업로드한 수강신청 원본 엑셀 데이터 구조를 완벽하게 유지한 채, 5단계에서 확정된 모든 과목 변경 사항만을 찾아 최신화한 뒤 엑셀 파일로 제공합니다.
- 상태 보존(Save/Load) 로직에 원본 엑셀 바이너리 데이터(`sampleRawData`)를 포함시켜 백업 파일 용량을 최적화하고 재업로드 없이 사용할 수 있도록 고도화되어 있습니다.

---

## ⚠️ AI 에이전트를 위한 향후 개발 가이드라인 (Rules)

1. **탭 컨테이너 구조 (Hooks + Step Components 분리) — 2026-07-19 대규모 리팩터링으로 확립:**
   - 위 "코드 아키텍처 개요" 섹션을 반드시 먼저 읽으세요. 컨테이너 파일에 직접 state나 JSX를 다시 쌓지 말고, 훅/스텝 컴포넌트 분리 패턴을 유지하세요.
2. **상태 관리 및 학년 분리:**
   - 예비1/2학년과 3학년 데이터는 UI 뷰뿐만 아니라 내부 상태(과거 이수 과목 데이터, 백업 내역 등) 역시 `Record<GradeKey, ...>`와 같은 형태로 각각 완벽하게 분리된 상태로 유지보수해야 합니다.
3. **분반 정규식 로직 절대 유지:**
   - `cleanBase`와 `cleanChosen`을 통해 모든 공백과 기호를 무시하고 매칭하는 로직을 함부로 축소하지 마세요. 타이포그래피 오타 보정 필수 로직입니다.
4. **2단계 교환 검증 로직 완벽 탐색:**
   - 과목이 개설된 모든 타임을 전부 탐색하여 가능한 Swap 경우의 수를 모두 시도해야 합니다.
5. **연쇄적 상태 업데이트(Working Copy):**
   - 4단계 교환 로직에서 `studentSchedules`와 같은 '임시 시간표'를 만들어 변경이 발생할 때마다 실시간으로 갱신해야 충돌 에러가 발생하지 않습니다.
6. **원본 데이터 보존 원칙:**
   - 교육과정 편제 파싱 시 로마자(Ⅰ, Ⅱ)를 아라비아 숫자로 강제 변환하지 않고 엑셀 원본 그대로 표기합니다.
7. **UI/UX 기준 및 레이아웃:**
   - 기능 추가 시 Tailwind CSS를 이용해 **직관적이고 미려한 UI(hover 애니메이션, 트랜지션, 색상 조화)**를 필수로 유지하세요. 가로 비율을 최대한 활용하여 한눈에 직관적으로 파악할 수 있는 넓은 레이아웃(최소화된 여백)을 유지하세요.
   - **현재 테마는 크림/앰버 라이트 테마입니다** (2026-07-19 전환, 배경 `bg-orange-50`, 카드 `bg-white/70~95 backdrop-blur-xl border-stone-200`, 포인트 컬러 amber/rose/emerald). 다크(slate-950) 테마로 되돌리지 마세요. 새 강조색 텍스트는 반드시 `-700` 이상의 진한 톤을 쓰고(옅은 `-200/-300/-400`은 흰 배경에서 시인성이 크게 떨어짐), solid/saturated 배경 버튼만 `text-white`를 유지하고 옅은(`-50/-100`) 배경 버튼은 진한 텍스트를 쓰세요. 자세한 배경은 아래 2026-07-19 히스토리 로그 참고.
   - 네비게이션 요소들은 본문을 가리지 않도록 **상단 고정 헤더**나 **사이드바(Bookmark Style Hover UI)** 형식으로 콤팩트하게 구성해야 합니다.
8. **백업 및 불러오기 안정성 유지:**
   - 시스템 상태 구조 변경 시 기존 JSON 백업 파일과의 하위 호환성을 보수적으로 짜야 합니다. 최신 `File System Access API`를 사용해 저장 위치 지정을 지원하세요.
9. **엑셀 내보내기 서식 세밀화 (엑셀 다운로드 유지 보수):**
   - 학생 명단 다운로드 시 단순 텍스트 출력이 아닌, 모든 셀에 테두리를 두르고 적절한 배경색을 지정하며 글꼴을 굵게(BOLD) 처리하는 등 미려한 서식을 강제해야 합니다.
   - 셀 내에서 과목명과 교사명이 함께 출력되어야 할 경우, 하나의 셀에 우겨넣지 말고 위아래 셀을 분리(Row 분할)하여 사용자가 엑셀에서 확인하기 쉽게 구성해야 합니다.
10. **업로드 UI 상태 보존:**
    - 실제 업로드된 파일명을 명시해주고 원상태로 복구할 수 있는 '삭제' 기능을 필수적으로 제공해야 합니다. 하위 파생 데이터 연쇄 삭제 로직도 포함하세요.
11. **예외 처리 및 안전장치 강화:**
    - 최적화 알고리즘 루프 내 특정 학생의 데이터 누락 대비 방어 코드(`if (optimizedLogs[studentId])`)를 필수로 작성하세요.
12. **입력 폼 정렬 UX (Jumping 방지 및 최상단 고정 로직):**
    - 새로 추가된 항목에 `isNew` 플래그를 달아 최상단에 고정시키고, 필수 필드가 채워진 후 포커스를 잃었을 때(`onBlur`) 정렬되도록 하세요.
13. **복합 상태(Compound State) 렌더링 최적화:**
    - 여러 상태가 융합되어 뷰나 연산 로직에 파이프라인되는 경우, 종속성 배열(`Dependency Array`)에 모든 상태를 명시적으로 등록하세요.
14. **반응형 테이블 너비 고정 (Dummy Columns):**
    - 빈 가짜 열(Dummy Column)을 사용하여 1개의 열만 표시될 때도 기존 최대 너비를 그대로 유지시켜 과도한 늘어짐을 방지하세요.
15. **사이드바 호버 액션 로직 보존:**
    - 사이드바(Aside) 호버 기능을 구현할 때 CSS 기반의 `group-hover`가 오작동할 수 있으므로, 반드시 React 상태 기반(`onMouseEnter`, `onMouseLeave`) 로직을 활용해 안정적인 확장을 보장해야 합니다.
16. **레이아웃 여백 최소화 유지:**
    - 메인 데이터 테이블을 감싸는 컨테이너는 화면 넓이를 100% 활용할 수 있도록 좌우 Padding을 최소화(예: `p-4`)하고 `max-w` 제약을 해제하여 넓은 시야를 제공해야 합니다.

---

## 🚀 배포(Deployment) 가이드라인 (NAS / Docker 환경)
- **메모리 최적화 (OOM 방지):** Synology NAS 등 저사양 기기에서 배포할 때 `npm ci`나 `npm install` 과정에서 "Exit handler never called!" 메모리 초과 에러가 발생할 수 있습니다. 이를 방지하기 위해 `Dockerfile`은 무조건 `node:20-slim` 기반 이미지를 사용하고 패키지 설치는 가벼운 `yarn install`을 사용합니다. (`node-alpine`의 musl libc 충돌 버그 우회)
- **네트워크 설정 (DNS 해상도 오류 방지):** NAS 도커 환경에서 라이브러리 다운로드 시 `getaddrinfo EAI_AGAIN` 인터넷 연결 오류가 발생하는 경우가 많습니다. 이를 해결하기 위해 `docker-compose.yml`의 `build` 섹션에는 반드시 `network: host`를 포함해야 합니다.
- **배포 자동화 스크립트:** 프로젝트 최상단에 있는 `deploy.sh` 스크립트를 사용하여 로컬에서 NAS로 파일을 전송(rsync/scp)하고, SSH로 원격 접속하여 `sudo docker compose up -d --build`를 실행하는 구조로 되어있습니다. (사용자 비밀번호 입력 필요)
- **Next.js Standalone 빌드:** Next.js 최적화 빌드를 위해 `next.config.ts`에 `output: 'standalone'` 설정이 켜져 있습니다.
- **schedule-helper용 환경변수 (2026-07-21 추가):** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`이 배포 환경에도 설정되어 있어야 합니다. SQLite 파일 경로를 Docker 볼륨에 마운트해서 컨테이너 재시작 시에도 학교/계정 데이터가 유지되게 하세요. 배포 스텝에 `npx prisma migrate deploy`를 추가해야 합니다(아직 `deploy.sh`에 반영 안 됨).
- **네이티브 모듈 빌드 주의:** `better-sqlite3`(Prisma의 SQLite 드라이버 어댑터가 사용)는 설치 시 네이티브 바인딩을 컴파일/다운로드합니다. 위 "메모리 최적화" 항목의 저사양 NAS OOM 이슈와 겹칠 수 있으니, 배포 환경에서 설치가 실패하면 이 패키지의 prebuild 바이너리 다운로드/컴파일부터 의심하세요.

---

## 🎨 UI/UX 및 레이아웃 가이드라인
- **사이드바 (Floating Tabs):** 왼쪽 메뉴(수요조사, 선택과목 변경)는 전체를 덮는 꽉 찬 배경이 아니라, 탭 항목 각각이 개별적인 배경과 그림자(`shadow-lg`, `rounded-r-2xl`)를 가지는 플로팅(Floating) 디자인으로 구현되어 있습니다. 전체 컨테이너는 투명하게(`bg-transparent`, `pointer-events-none`) 유지하여 탭 사이의 빈 공간을 클릭할 수 없도록 설계되었습니다.
- **헤더와 탭 영역 가로 공간 확보:** 상단 '불러오기' 및 '저장하기' 버튼은 하단의 단계별 탭(1단계~8단계)과 같은 줄에 두지 않고, 최상단 제목(`<h1>`)과 같은 줄(동일한 flex-row) 우측에 배치해야 합니다. 이를 통해 하단의 단계별 탭 영역이 화면 가로 폭의 대부분(`max-w-[calc(100vw-120px)]`)을 온전히 사용할 수 있도록 확보해야 합니다.
- **모달(Popup) 창 너비 설정:** 가이드라인(예시 이미지 등)이 포함된 모달 창의 경우, 작은 화면에서 그림이 잘릴 수 있으므로 `max-w-4xl`과 같은 고정 크기 대신 뷰포트 대비 비율(`max-w-[80vw]`)을 사용하여 충분한 가로 공간을 확보합니다.
- **헤더 공간 최적화:** 수요조사와 선택과목 변경 탭 상단의 불필요한 설명 텍스트를 제거하고, 1단계와 2단계 버튼을 메인 헤더 영역으로 옮겨 화면의 세로 여백을 최소화했습니다.
- **데이터 테이블 가로 확장:** 명단과 통계를 보여주는 테이블 컨테이너의 가로 여백(max-w-7xl 등) 제약을 완전히 풀고 화면 좌우 끝까지 펼쳐지도록 확장하여 넓은 뷰를 제공합니다.

---

## 📅 개발 히스토리 로그 (최신순)

### 2026-07-22
**연수 이수증 수거(certificates) 앱 이식 — Google Apps Script → schedule-helper 서브 메뉴:**
- 사용자가 별도 운영하던 Google Sheets/Drive 기반 "교원 연수 이수증 제출 자동화 시스템"을 NAS Postgres 기반으로 완전히 새로 이식했습니다. 자세한 아키텍처는 위 "📜 연수 이수증 수거(certificates) 참고 메모" 섹션 참고. 별도 브랜치(`feature/training-certificates`)에서 작업했습니다.
- **Wave 1**: 제출하기(Gemini 2.5 Flash로 이수번호/기관/날짜 자동추출 → 확인모달 → 저장, 본인 이름 서버 강제)/내역조회(역할별 스코핑)/일괄확인(최초엔 admin-only)/Gemini API 키 학교별 등록 화면.
- **Wave 2**: QR 서명 수거 — 관리자가 세션(단일/복수 연수) 생성 → QR/URL 공유 → 교사가 **로그인 없이** 명단에서 이름 선택 후 캔버스 서명 → 관리자 화면에서 5초 폴링으로 진행률 확인, 잠금/인쇄. 원본 앱의 "익명 접근 + 세션 id가 유일한 접근통제" 설계를 그대로 유지(사용자 승인).
  - 개발 중 `SignSessionSignature`가 애초엔 `(session, teacher, trainingTitle)`별로 서명을 따로 받는 걸로 잘못 모델링했다가, 원본 `Code.gs`의 `submitSignature`가 실제로는 그룹 세션의 모든 연수에 동일 서명 1개를 동시에 적용한다는 걸 재확인하고 스키마를 교정(`trainingTitle` 필드 제거, unique를 `[sessionId, teacherName]`으로 축소)했습니다. 빈 테이블이라 마이그레이션 SQL을 직접 작성해 `migrate deploy`로 적용(비대화형 환경이라 `migrate dev`의 destructive-change 확인 프롬프트를 못 받았기 때문).
- **연수 제목 레지스트리(TrainingTitle)**: 자유 텍스트 제목 입력 방식을, 원본 앱의 드롭다운 UX를 재현한 사전 등록제로 전환 — 누구나 등록 가능, 등록된 연수는 전원 제출 가능, 일괄확인 조회/삭제는 관리자 또는 등록자 본인만 가능. `submit`에도 미등록 연수 제출을 막는 검증을 추가했습니다.
- 매 기능마다 disposable 테스트 학교(실제 회원가입/초대코드 플로우로 생성)로 종단 검증했고, 403/409/캐시누수 등 부정 경로도 실제로 재현해 확인했습니다. `tsc --noEmit`/`eslint` 신규 파일 범위 클린.
- **명단에 없는 인원 추가 기능 (CertificateRosterExtra)**: "시간표에 없는 직원(행정실 등)도 일괄확인/서명 대상에 넣고 싶다"는 요청으로, `Teacher` 테이블과 완전히 분리된 별도 명단(`CertificateRosterExtra`)을 추가했습니다. 이 이름들은 시간표 교체 도우미(SwapTab, `scheduleData.teachers` 기준)에는 영향을 주지 않고, 오직 이수증 기능의 일괄확인/서명 세션 로스터에만 합산됩니다(`getCertificateRoster()` 헬퍼). 관리자 전용 추가/삭제 UI(`ExtraRosterSettings.tsx`)를 `BulkCheckTab.tsx` 상단에 배치. 자세한 내용은 위 "📜 연수 이수증 수거" 섹션의 `CertificateRosterExtra` 항목 참고.

### 2026-07-21 (8)
**교사별 교체 금지 기능 추가 + 두 "교체 금지" 카드 좌우 그리드 배치:**
- 기존 "과목별 교체 금지"(시간 이동만 차단, 대강은 허용)와 별개로, 관리자가 특정 **교사**를 지정하면 그 교사는 **교체와 대강 모두** 완전히 제외되는 기능을 추가했습니다(예: 교장/교감처럼 애초에 교체 대상이 되면 안 되는 교사). 사용자에게 적용 범위를 직접 확인(AskUserQuestion)해서 "교체+대강 모두 차단"으로 결정했고, 이 점이 과목별 금지와의 유일한 차이입니다.
  - `School.blockedTeachers`(JSON: string[]) 필드 추가, `blocked-subjects` 라우트를 그대로 본떠 관리자 전용 `POST/DELETE /api/schedule-helper/blocked-teachers` 신설. 교사명은 `data.teachers`에 이미 정확한 목록이 있어(과목과 달리) 오타 폴백 UI가 필요 없습니다 — 검색 후 클릭으로 바로 추가.
  - `ScheduleContext`에 `isTeacherBlocked(teacher)` 추가하고 `SwapTab.tsx`의 세 지점에 적용: (1) `handleCellClick` 맨 앞에서 클릭한 교사 자신이 차단 대상이면 계산 자체를 건너뛰고 "교체·대강 모두 불가" 메시지만 표시, (2) 후보 탐색 `forEach` 루프 맨 앞에서 `isTeacherBlocked(otherRow.teacher)`면 스킵(Swap Logic과 Sub Logic 양쪽에 동시 적용), (3) 2단계 연쇄 교체의 B/C 후보 루프에도 동일하게 스킵 추가.
  - 로컬에서 실제로 검증: B 교사를 차단하니 A의 일반 교체 후보에서 사라짐(해제 후 재등장까지 확인), Y 교사를 차단하니 이동수업(체육A) 동과 대강 후보에서도 사라짐, X 교사 본인을 차단하니 자기 셀 클릭 시 차단 메시지만 표시됨을 확인.
- **UI 배치**: "과목별 교체 금지"와 "교사별 교체 금지" 카드를 `grid grid-cols-1 lg:grid-cols-2`로 묶어 넓은 화면에서는 좌우로 나란히, 좁은 화면에서는 자동으로 세로 스택되게 했습니다(이미 이 파일 다른 곳에서 쓰던 `lg:` 반응형 분기 관례 재사용).

### 2026-07-21 (7)
**2단계 연쇄 교체 UX 개선 + "과목별 교체 금지" + 과목 검색-선택 UI + 매칭 결과 패널 레이아웃 수정:**
- **2단계 연쇄 교체 UX**: 체크박스 다중 선택 방식을, 사용자 요청으로 클릭 한 번에 하나만 선택되는 단일 선택 방식으로 변경(`selectedChainIdx: number | null`, 같은 항목 재클릭 시 선택 해제). 두 번의 교체가 각각 어디서 일어나는지 구분되도록 1단계(B↔C 교체 두 칸)는 주황, 2단계(나↔B 교체 칸)는 보라로 셀 하이라이트 색을 분리했습니다.
- **과목별 교체 금지**: 관리자가 특정 과목명을 등록하면 그 과목은 어떤 교사가 가르치든 "일반 교체"와 "2단계 연쇄 교체" 양쪽에서 소스/후보 어느 쪽으로도 등장하지 않게 차단합니다(동과 대강은 시간 이동이 없어 예외). 사용자가 AskUserQuestion으로 "관리자만" 설정 가능하도록 확인했습니다. `School.blockedSubjects`(JSON) + 관리자 전용 `POST/DELETE /api/schedule-helper/blocked-subjects` + `ScheduleContext.isSubjectBlocked` + `SwapTab.tsx`의 소스/후보/체인 세 지점 모두에 체크 추가.
- **과목 검색-선택 UI**: "과목별 교체 금지"에 과목명을 자유 텍스트로 입력하면 오타로 실제 시간표 데이터와 어긋날 위험이 있어서, `src/features/schedule-helper/lib/utils.ts`에 `extractSubjects(tableData)`를 추가해 업로드된 시간표에 실제로 등장하는 과목명만 검색·클릭으로 선택하게 했습니다. `parseClassInfo`를 그대로 재사용해서 추출된 과목 문자열이 `SwapTab.tsx`의 매칭 로직이 비교하는 값과 항상 바이트 단위로 일치하도록 보장합니다(이동수업 블록 글자 포함, 예: "체육A"). 시간표가 아직 없거나 정말 새로운 과목명을 등록해야 하는 예외 상황을 위한 "직접 추가" 폴백 경로도 별도로 남겨뒀습니다.
- **매칭 결과 패널 레이아웃**: "수업 매칭 결과" 패널이 `fixed` 오버레이라 화면 우측 요일 컬럼(예: 금요일)을 가린다는 스크린샷 제보를 받아, 테이블과 패널을 형제 flex 아이템으로 묶는 도킹형 사이드 패널(`flex flex-col lg:flex-row`, 넓은 화면은 테이블 오른쪽 `lg:sticky`, 좁은 화면은 테이블 아래로 스택)로 바꿔 구조적으로 아무것도 가리지 않게 했습니다.
- 네 가지 모두 로컬에서 실제 시드 데이터로 검증(음성 대조 포함), `tsc --noEmit` 클린. 커밋 시점에 (6)의 2단계 연쇄 교체 기능과 함께 하나로 합쳐졌습니다.

### 2026-07-21 (6)
**Vercel 프로덕션 로그인 불가 버그 수정 + SwapTab에 "2단계(연쇄) 교체" 기능 추가:**
- **로그인 버그**: 프로덕션(`subject-selector.vercel.app`)에서 로그인 시 "로그인 중..." 표시 후 그냥 버튼이 다시 활성화되는 문제 신고. 원인은 Vercel 프로덕션 `BETTER_AUTH_URL` 값이 손상돼 있던 것 — `better-auth`가 `new URL(BETTER_AUTH_URL)`을 실패시켜 `next build`의 정적 페이지 생성 단계에서 `Invalid base URL` 에러를 던졌습니다(런타임에도 origin 검증에 영향). **`"값" | npx vercel env add NAME production`처럼 셸 파이프로 값을 넣으면 이 환경에서 값이 깨질 수 있다는 걸 재현으로 확인**했습니다(평범한 테스트 문자열도 파이프로 넣으면 손상됨) — 파일로 값을 적어두고 `npx vercel env add NAME production < file.txt`로 리다이렉트하니 정상 저장되고 `vercel --prod` 빌드가 깨끗하게 통과했습니다. **앞으로 Vercel 환경변수를 CLI로 설정할 땐 파이프 대신 파일 리다이렉트를 쓰세요.**
  - 참고로 이 환경(Claude Code 세션)의 로컬 도구는 Vercel이 "Sensitive" 타입으로 표시한 환경변수 값을 `vercel env pull`로 가져와도 전부 `[SENSITIVE]`(11자 고정 문자열)로 가려서 보여줍니다 — 값이 진짜 11자라서가 아니라 로컬 표시가 가려지는 것이니, 값 검증은 `vercel env pull` + 파일 읽기가 아니라 실제 빌드/로그인 시도 같은 동작 확인으로 해야 합니다.
  - 코드 변경은 없었고(순수 Vercel 프로젝트 설정 문제) 커밋 없이 인프라만 수정했습니다.
- **2단계(연쇄) 교체**: `SwapTab.tsx`의 "일반 수업 교체"(1단계, A↔B 직접 교체)가 대상이 없을 때, 자동으로 "2단계 교체" 후보를 찾아 보여줍니다. A↔B가 안 되는 이유가 "B가 그 시간에 이미 다른 수업(W)이 있어서"인 경우, W와 같은 반을 가르치는 C를 찾아 B↔C를 먼저 교체하면 B가 그 시간에 비어 A↔B가 가능해지는 조합을 탐색합니다(3개 중첩 반복문, `results.swap.length === 0`일 때만 실행, 후보 최대 6개로 컷).
  - 각 후보는 체크박스로 표시되고, **체크하는 즉시**(별도 "적용" 버튼 없이) 시간표에서 관련 칸이 강조됩니다 — 처음엔 "적용" 버튼을 따로 뒀었는데 사용자가 그 버튼 없이 바로 보이게 해달라고 해서 `checkedChainIdx`만으로 하이라이트를 직접 구동하도록 단순화했습니다.
  - 1단계(B↔C 교체 대상 두 칸)는 주황색, 2단계(A↔B, 내가 B의 시간으로 이동하는 칸)는 보라색으로 서로 다르게 강조해서 두 번의 교체가 각각 어디서 일어나는지 구분되게 했습니다.
  - 이 기능은 시간표 데이터를 실제로 바꾸지 않는 순수 조회/안내 도구입니다(사용자 확인: "화면에만 확정 표시" — DB에는 아무것도 반영되지 않음).

### 2026-07-21 (5)
**관리자 화면에 학교 초대 코드 다시 보기 기능 추가:**
- 초대 코드(`School.joinCode`)는 "학교 만들기" 가입 성공 화면에서 딱 한 번만 보여주고 저장할 방법이 없었는데, 사용자가 "따로 기록 안 해두면 잊어버린다"고 지적해서 관리자가 로그인 후에도 다시 확인할 수 있게 했습니다.
- `src/app/api/schedule/route.ts`의 `GET` 응답에 `joinCode` 필드를 추가하되 `session.user.role === "ADMIN"`일 때만 값을 채우고, TEACHER 계정은 `null`을 받습니다(실제로 TEACHER 세션으로 확인함). 별도 API를 새로 안 만들고, 이미 로그인 시 한 번 불러오는 `/api/schedule`(`ScheduleContext`)에 얹었습니다.
- `src/app/apps/schedule-helper/(app)/page.tsx` 관리자 헤더에 "초대 코드" 토글 버튼을 추가 — 클릭하면 코드와 복사 버튼이 있는 카드가 펼쳐집니다.

### 2026-07-21 (4)
**교과군 그룹 관리 + "내 시간표" 고정 기능 추가, 캐시 미갱신 버그 수정:**
- **교과군 그룹 관리**: 교사 목록 관리 화면에서 교사 한 명씩 "교과군" 텍스트를 입력하던 방식을, 학교 단위로 그룹(기본 국어/영어/수학/사회/과학 + 커스텀 추가/삭제 가능)을 먼저 만들고 그룹을 선택해 소속 교사를 체크박스로 한 번에 배정하는 방식으로 바꿨습니다.
  - `School.departmentGroups`(JSON 문자열 배열, `globalMeetingBlocks`와 동일 패턴) 필드 추가.
  - `POST/DELETE /api/schedule-helper/departments` — 그룹 추가/삭제(삭제 시 소속 교사는 `department: null`로 미배정).
  - `POST /api/schedule-helper/teachers/assign-department` — 그룹 하나에 교사 여러 명을 한 번에 배정. `$transaction`으로 "기존 소속 전원 해제 → 새 명단 배정" 2쿼리만 실행 — 위 2026-07-21 (3) 항목에서 배운 "NAS 왕복 최소화" 원칙을 그대로 적용했습니다.
  - `Teacher.department`는 이미 `SwapTab.tsx`의 "동과 대강" 매칭(`teacherDepts`, 문자열 완전일치)에 쓰이고 있어서 데이터 모델은 안 건드리고 입력 방식만 바꿨습니다.
- **캐시 미갱신 버그 발견 및 수정**: 교과군을 그룹으로 재배정한 뒤 "수업교체 도우미" 화면에서 "동과 대강" 추천이 안 뜬다는 제보를 받고 확인해보니, `teachers/page.tsx`와 `page.tsx`(SwapTab)가 `(app)/layout.tsx` 하나를 같이 쓰면서 `ScheduleProvider`(시간표 데이터)를 공유하는데, 이 데이터는 최초 진입 시 한 번만 fetch되고 이후 자동 갱신이 안 됩니다. 그래서 교사 목록 관리에서 교과군을 바꿔도, 같은 세션에서 이미 로드된 수업교체 화면은 예전 데이터(교과군 미배정 상태)를 계속 들고 있었던 것 — **관리자 화면에서 시간표에 영향을 주는 값(교과군, 고정 교체불가 등)을 저장할 때는 반드시 `useSchedule()`의 `refetch()`를 호출**하도록 `teachers/page.tsx`의 저장/삭제 핸들러 3곳(교과군 배정 저장, 교과군 삭제, 고정 교체불가 저장)에 추가했습니다. 앞으로 이 두 라우트 그룹 사이에 새로운 저장 액션을 추가할 때도 이 패턴을 잊지 마세요.
- **"내 시간표" 행 고정**: 로그인 계정의 이름(가입 시 입력한 이름 — 관리자든 "코드로 가입"한 교사든 동일)과 정확히 일치하는 교사 행을 `SwapTab.tsx` 표 맨 위에 `position: sticky`로 고정(📌 아이콘 + 앰버 배경)해서, 스크롤해도 항상 자기 시간표가 보이도록 했습니다. sticky `top` 값은 `thead`에 `ref`를 걸어 `getBoundingClientRect().height`로 동적으로 측정합니다(헤더가 2단 구조라 고정 픽셀값을 하드코딩하면 깨지기 쉬움). 이름이 시간표의 교사명과 정확히 일치하지 않으면 그냥 아무 행도 고정되지 않고 기존처럼 동작합니다.

### 2026-07-21 (3)
**시간표 업로드가 Vercel 프로덕션에서만 실패하던 버그 수정:**
- 사용자가 실제 배포(`subject-selector.vercel.app`)에서 학교 계정을 만들고 로그인하는 건 됐는데 "시간표 엑셀 업로드"가 매번 "업로드에 실패했습니다"로 실패한다고 보고했습니다. 로그인/가입은 재현이 안 됐는데(쿼리 1번짜리라 안 걸림), 업로드만 실패한다는 게 단서였습니다.
- `npx vercel inspect <url> --logs` / `npx vercel logs <url>`로 실제 함수 로그를 확인해 원인을 특정했습니다: `POST /api/schedule-helper/upload`가 `Prisma.$transaction` 안에서 교사 한 명당 `upsert()` 쿼리를 하나씩(N개) 날리고 있었는데, DB(NAS, 한국)와 Vercel 함수(iad1, 미국) 사이 왕복 지연이 쌓여 Prisma 기본 트랜잭션 타임아웃(5000ms)을 넘겨버렸습니다(`P2028`, "rollback cannot be executed on an expired transaction"). 로컬 개발 환경은 NAS와 같은 LAN이라 지연이 거의 없어서 이 버그가 로컬에서는 재현되지 않습니다 — **DB가 원격(NAS)에 있는 이상, 왕복 횟수가 많은 쿼리 로직은 반드시 프로덕션(Vercel↔NAS 실제 경로)에서 검증해야 합니다.**
- `src/app/api/schedule-helper/upload/route.ts`: 교사별 `upsert` 반복(`update: {}`라 사실상 "없으면 삽입"이었음)을 `prisma.teacher.createMany({ data, skipDuplicates: true })` 배치 삽입 하나로 교체해 왕복 횟수를 N+1 → 2로 줄이고, `$transaction`에 `{ timeout: 15000 }`을 명시해 여유를 뒀습니다. **비슷하게 "루프 안에서 개별 upsert/create를 반복"하는 코드를 새로 짤 때는, DB가 NAS 원격에 있다는 걸 감안해 가능한 한 배치 API(`createMany`/`updateMany`/raw SQL bulk)로 왕복을 줄이세요.**

### 2026-07-21 (2)
**배포 아키텍처를 "앱=Vercel, DB=NAS Postgres"로 재구성:**
- 멀티테넌트 전환(바로 아래 2026-07-21 항목) 직후 사용자가 GitHub main을 이미 Vercel과 연결해뒀다는 걸 알게 됐고(`https://subject-selector.vercel.app`), 그 배포가 실패 상태로 옛날 빌드만 계속 서빙되고 있는 걸 발견했습니다. 원인은 `src/generated/prisma`가 gitignore되어 있는데 빌드 파이프라인에 `prisma generate`가 없었던 것 — `package.json`에 `postinstall: "prisma generate"`를 추가해 해결했습니다.
- 이 김에 SQLite가 Vercel 서버리스 환경(읽기 전용 파일시스템, 인스턴스 간 비영속)과 근본적으로 안 맞는다는 점도 확인 → NAS는 그대로 두고(`sudo docker compose up -d --build`가 `sudo` 비밀번호 프롬프트에서 막혀 완주 못함), **NAS를 DB 전용으로만 쓰고 앱은 Vercel에서 서빙**하는 방향으로 전환했습니다.
- NAS의 `fbalswp` 계정을 `docker` 그룹에 추가해 이후 `sudo` 없이 원격 Docker 작업이 가능하게 만들었습니다.
- NAS에 Postgres 컨테이너(`postgres:16-alpine`)를 새로 띄우고, Prisma datasource를 `sqlite` → `postgresql`로, 드라이버 어댑터를 `@prisma/adapter-better-sqlite3` → `@prisma/adapter-pg`로 교체(`src/lib/prisma.ts`). `src/lib/auth.ts`의 `prismaAdapter(prisma, { provider: ... })`도 같이 "postgresql"로 맞춰야 했는데 처음에 놓쳤다가 뒤늦게 발견해 수정했습니다 — 다행히 로컬 테스트에서는 provider 불일치 상태로도 기본 CRUD는 우연히 잘 동작해서 눈치채기 어려웠던 부분이라, 이후 DB provider를 바꿀 땐 `auth.ts`도 같이 확인하세요.
- 기존 sqlite 전용 마이그레이션 SQL은 postgres 문법과 안 맞아 재사용 불가 — `prisma/migrations`를 통째로 지우고 postgres 기준으로 새로 생성했습니다.
- 라우터에 외부 TCP `55432` → NAS `192.168.0.21:55432` 포트포워딩을 뚫고, `fbalswp.duckdns.org:55432`로 실제 Postgres 프로토콜 연결(인증+쿼리)까지 외부에서 성공하는 것을 확인했습니다. 로컬 개발 환경은 같은 LAN이라 포트포워딩을 거치지 않고 `192.168.0.21:55432`로 직접 접속하도록 `.env`를 구성했고, Vercel 프로덕션 환경변수(`DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`)는 `npx vercel env add`로 등록했습니다.
- Vercel의 실제 프로덕션 URL이 `subject-selector.vercel.app`(짧은 alias)이고, `vercel ls`가 보여주는 `-minje88` 접미사 URL은 Deployment Protection이 걸린 배포별 URL이라는 것도 이번에 파악했습니다 — 자세한 내용은 위 "🌐 배포 아키텍처" 섹션 참고.
- 부수 정리: 더 이상 안 쓰는 `bcryptjs`/`better-sqlite3`/`@prisma/adapter-better-sqlite3` 의존성을 제거했습니다.
- Windows Git Bash에 `rsync`가 없어서 `deploy.sh`(NAS 앱 배포용)가 이 환경에서 실행 불가능하다는 것도 확인 — 지금은 NAS 앱 배포 자체를 쓰지 않기로 해서 급하지 않지만, 나중에 다시 필요해지면 `deploy.sh`를 tar+scp 기반으로 바꾸거나 rsync를 설치해야 합니다.

### 2026-07-21
**schedule-helper를 멀티테넌트(학교별 계정) 서비스로 전환:**
- 사용자가 "다른 학교에서도 쓸 수 있게" 확장하고 싶다고 요청 → "한 서비스에 여러 학교가 가입해서 공유" 방식(계정/DB 필요)으로 명확히 확인한 뒤 진행했습니다. 교사 초대는 학교 코드 셀프 가입, 시간표는 학교당 1개만 유지, 도메인 분리 없이 단일 URL — 이렇게 범위를 정했습니다.
- Prisma + SQLite(better-sqlite3 드라이버 어댑터) 도입, better-auth로 이메일/비밀번호 인증 추가(NextAuth v5가 계속 beta에 머물러 있어 안정 버전이 나온 better-auth로 최종 선택). `School`/`Teacher` 두 모델과 better-auth가 관리하는 `User`/`Session`/`Account`/`Verification`으로 스키마 구성.
- 구글 시트 자동 fetch를 완전히 제거하고, 관리자가 앱 안에서 직접 엑셀을 업로드하는 방식으로 전환(`parseScheduleWorkbook`). 업로드 시 교사 이름으로 `Teacher` 레코드를 자동 upsert.
- "설정" 엑셀 시트가 담당하던 교과군/고정 교체불가/협의회 불가 설정을 대체하는 **교사 목록 관리 화면**(`/apps/schedule-helper/teachers`, 관리자 전용)을 새로 만들었습니다.
- 브라우저 localStorage 전용이던 "오늘 결근" 임시 설정을 학교 전체가 공유하는 서버 데이터(`Teacher.tempBlockDays`)로 승격했습니다.
- `/apps/schedule-helper` 전체를 `src/proxy.ts`(Next.js 16의 새 `middleware.ts` 대체 파일명, 기본 Node.js 런타임이라 better-sqlite3 같은 네이티브 모듈을 인증 체크에 쓸 수 있음)로 로그인 게이트를 걸었습니다. 로그인/가입 페이지는 `ScheduleProvider`가 불필요한 fetch를 하지 않도록 `(app)` 라우트 그룹 밖으로 분리했습니다.
- 자세한 아키텍처는 위 "🏫 schedule-helper 멀티테넌트(학교별 계정) 아키텍처" 섹션 참고.
- 실제 사용자가 제공한 명신고 시간표 엑셀(교사 53명)로 학교 생성 → 업로드 → 교체/협의회/임시설정 탭 → 교사 목록 관리 → 로그아웃/로그인까지 브라우저에서 전부 검증했습니다. 검증에 쓴 테스트 계정/학교 데이터는 모두 정리해서 DB를 깨끗한 상태로 남겨뒀습니다 — 실제 관리자 비밀번호는 제가 대신 만들지 않고, 사용자가 직접 가입 화면에서 설정하도록 남겨둔 것입니다.

### 2026-07-20 (3)
**schedule-helper 헤더에 원본 구글 시트 바로가기 버튼 추가:**
- `src/features/schedule-helper/lib/sheetData.ts`에 `SHEET_ID`/`SHEET_EDIT_URL` 상수를 export하도록 정리(기존엔 export URL 문자열 하나만 파일 내부 private 상수였음)하고, `src/app/apps/schedule-helper/page.tsx` 헤더 우측 상단에 새 탭으로 여는 링크 버튼을 추가했습니다.

### 2026-07-20 (2)
**"쌤스 헬퍼" 부서 신설 및 별도 저장소 앱(schedule-helper) 통합:**
- 사용자가 "큰 목록"(허브 왼쪽 부서 pill)에 "쌤스 헬퍼 (T-Helper)" 부서를 추가하고, "작은 목록"(오른쪽 앱 카드)에 "시간표 교체 도우미"를 연결해달라고 요청했습니다.
- 이 도구는 완전히 별도의 GitHub 저장소(`Ryuminje/Myunshinh-schedule-app`, Vercel에 이미 배포되어 있던 독립 Next.js 프로젝트)로 존재했습니다. 소스를 클론해 스택 호환성(Next 16 / React 19 / Tailwind v4, 동일)과 외부 의존성(구글 시트 공개 export URL만 fetch, DB/시크릿 없음)을 먼저 확인한 뒤, 이 저장소 안으로 코드를 통째로 포팅해 `/apps/schedule-helper`로 합쳤습니다.
- 자세한 포팅 방식(파일 매핑, 의존성 선별, 포팅 중 고친 실제 버그 2개)은 위 "🧩 별도 앱 통합(schedule-helper) 참고 메모" 섹션에 정리했습니다. 앞으로 또 다른 저장소를 합칠 때 그대로 재사용하세요.
- `src/config/hub.ts`에 `HubDepartment` 두 번째 항목으로 "쌤스 헬퍼" 부서를 추가했고, 왼쪽 pill 색상 순환(`palette` 배열) 두 번째 색(rose)이 자동으로 적용됩니다.
- 브라우저에서 실제 구글 시트 데이터 로딩, 3개 탭(교체 시간표 찾기/협의회 시간 찾기/교체 불가 설정) 전환, 셀 클릭 시 교체 후보 검색 결과, 허브 왕복 링크까지 전부 수동 검증했습니다. tsc/eslint(새 파일 기준) 클린, 기존 `enrollment-helper` 회귀 없음 확인.

### 2026-07-20
**학교 업무 도구 허브(랜딩) 페이지 신설:**
- 기존에는 `/`가 곧 수강신청 정리 도구였으나, 앞으로 여러 앱을 한 곳에 모을 필요가 생겨 `/`를 허브 페이지로 만들고 기존 도구를 `/apps/enrollment-helper`로 분리했습니다.
- 허브는 좌측 부서 pill 목록(큰 목록) → 우측 선택된 부서의 앱 카드 목록(작은 목록)의 2단 레이아웃이며, DoRms 오픈소스 링크트리 템플릿의 UI 컨셉을 참고해 자체 구현했습니다. 자세한 구조는 위 "🏠 홈 화면(허브) 라우팅 구조" 섹션 참고.
- 허브 콘텐츠(학교명/소개문구/부서/앱)는 `src/config/hub.ts`에 데이터로 완전히 분리되어 있어, 향후 다른 앱들을 합칠 때 이 파일의 배열에 항목만 추가하면 됩니다. 현재는 "교육과정부" 부서 하나에 "수강신청 자료 정리 도우미" 앱 하나만 등록되어 있습니다.
- `src/app/layout.tsx`의 메타데이터(title/description/lang)도 실제 학교/서비스명에 맞춰 갱신했습니다.

### 2026-07-19 (라이트 테마 전환)
**전체 다크 테마 → 크림/앰버 라이트 테마 전환:**
- 사용자가 기존 다크(`bg-slate-950` 배경, indigo 포인트) 디자인이 마음에 안 든다고 하여, Dribbble 레퍼런스(푸드 브랜드 랜딩 페이지)에서 색상 팔레트 언어만 차용해 파일럿 화면(교과군별 시수 정리)에 먼저 적용하고 승인을 받은 뒤 전체 앱(3개 탭, 모든 스텝, 사이드바/헤더, 공용 `SearchableSelect`)으로 확산했습니다.
- 색상 매핑: `slate` 배경/테두리/텍스트 → `stone`/`white`, `indigo` 포인트 → `amber` 포인트. 카드류는 `bg-white/70~95 backdrop-blur-xl border-stone-200`로, 배경 그라디언트 블롭은 `bg-amber-300/25` / `bg-rose-300/20`으로 통일.
- **반복해서 발생했던 버그 패턴 (새 UI 작성 시 주의):**
  1. 다크 테마에서 밝게 보이던 강조색 텍스트(`text-{color}-200/300/400`)를 라이트 배경에 그대로 두면 시인성이 크게 떨어집니다. 자동 변환 스크립트가 `-400`만 처리하고 기존에 있던 `-200/-300`(변경 이력 뱃지 등)을 놓쳐 실제로 사용자가 스크린샷으로 버그를 제보했습니다 (`AnalysisStep.tsx`, `RosterAfterStep.tsx`, `RosterStep.tsx`). 새 강조색 텍스트는 항상 `-700` 이상을 사용하세요.
  2. "옅은(`-50/-100`) 배경 위 버튼"과 "solid/saturated 배경 버튼"을 구분하지 않고 일괄로 `text-white`를 적용하면 옅은 배경 버튼 글자가 안 보이게 됩니다(`CurriculumStep.tsx`의 "올바른 엑셀 입력 예시 보기" 버튼에서 실제 발생). solid 배경만 `text-white`, 옅은 배경은 진한(`-700`~`-800`) 텍스트를 쓰세요.

### 2026-07-19
**3개 탭 컨테이너 대규모 리팩터링 (사용자 기능 변경 없음, 순수 구조 개선):**
- `ChangeSurveyTab.tsx`, `MainSurveyTab.tsx`, `DemandSurveyTab.tsx`가 각각 2200~2800줄짜리 단일 파일에 state, 비즈니스 로직, JSX 렌더링이 전부 뒤섞여 있던 것을 정리했습니다.
- **1단계 (죽은 코드 제거):** 각 탭 파일에 다른 탭 전용으로만 쓰이던(백업 함수의 get/load에만 등록되고 실제로는 어디서도 읽히지 않던) state를 파일당 15~20개씩 발견해 제거했습니다. 세 탭이 서로 복사-붙여넣기로 만들어지며 남은 잔재였습니다.
- **2단계 (훅 분리):** state와 핸들러 로직을 `src/features/<feature>/hooks/*.ts`로 이동했습니다 — 교육과정/위계 업로드, 원본 파일 업로드/파싱, 선택과목 변경 및 인원 균등화 최적화(Hill Climbing) 알고리즘, 반편성/교과군별 시수 정리 및 각종 엑셀 export 등.
- **3단계 (스텝 컴포넌트 분리):** 각 탭의 1~8단계 JSX를 `src/features/<feature>/components/*Step.tsx`로 이동했습니다.
- **결과:** 세 컨테이너 파일 모두 340~420줄 수준(원래의 12~19%)의 순수 컨테이너로 축소되었습니다. tsc/eslint 통과 확인, 브라우저에서 전 탭·전 단계 렌더링과 엑셀 다운로드·백업 저장/불러오기를 수동 검증했습니다.
- **부수 발견:** `demand-survey`와 `main-survey`의 로직을 비교(diff)한 결과, 교육과정 파싱은 완전히 동일했고(재사용/재-export 처리), 업로드 파싱 방식과 일부 텍스트 라벨만 실제로 달랐습니다. 또한 `MainSurveyTab`(본조사)이 `DemandSurveyTab`(수요조사)을 복사해 만들다 미완성으로 남은 상태(예: 엑셀 입력 예시 모달 부재)임을 확인했습니다 — 자세한 내용은 위 "코드 아키텍처 개요" 및 규칙 1번 참고.

### 2026-07-13
**인원 균등화 최적화 알고리즘(Hill Climbing) 불가 로그(버그) 완벽 수정:**
- **문제점:** 최적화 알고리즘이 내부적으로 학생의 시간표를 1:1 교환하여 완벽하게 균등 분배를 달성했음에도, UI에 로그를 띄워주기 위해 '원래 시간표'와 '최종 시간표'를 뭉뚱그려서 차이점(Diff)으로 추출하는 과정에서 오류가 발생했습니다. 이 차이점을 넘겨받은 검증 로직(DFS)이 3중 이상의 다중 교환(예: A->B->C) 과정을 이해하지 못해, `물질과에너지 -> 물질과에너지 (불가)` 와 같은 비정상적인 실패 로그를 내뿜으며 최적화 결과를 누락시키는 치명적인 버그가 있었습니다.
- **해결책:** Diff 비교 방식을 전면 폐기하고, 최적화 알고리즘 루프 내부에서 **유효한 1:1 교환(Swap)이 일어날 때마다 실시간으로 정확한 발자취(History)를 직접 기록**하여 넘겨주도록 아키텍처를 변경했습니다.
- **결과:** 검증 로직(DFS)이 최적화 알고리즘이 개척한 완벽한 교환 경로를 순서대로 그대로 따라가게 되어 더 이상 중간에 에러(불가) 판정을 내리지 않게 되었습니다. 이제 알고리즘이 찾아낸 모든 최적의 시간표가 100% 누락 없이 성공적으로 학생 명단에 반영됩니다.

**수요조사 탭 1단계 엑셀 예시 가이드 모달 창 UI 복구 및 개선:**
- 상태값 제어만 존재하고 렌더링 코드가 누락되어 팝업이 뜨지 않던 문제를 수정하여 모달 UI를 완전히 복구했습니다.
- 사용자가 '올바른 예시'와 '잘못된 예시'를 위아래로 스크롤하지 않고 한눈에 직관적으로 비교할 수 있도록 `grid-cols-2` 속성을 적용하여 **좌우(Side-by-Side) 레이아웃으로 변경**했습니다. 화면 높이에 맞춰 이미지가 자동으로 조절되도록 `object-contain` 설정을 추가했습니다.

### 2026-07-12
**V2 통합 백업 시스템 구축 (전체 탭 상태 일괄 저장):**
- 기존에는 각 탭(수요조사, 수강신청 본조사, 선택과목 변경)별로 작업 내역을 따로 저장해야 했으나, 이제 하나의 JSON 백업 파일(`version: 2`)에 세 탭의 모든 상태가 통합되어 저장 및 복구되도록 구조를 대폭 개선했습니다.
- 전역 스코프(`window.getMainBackup` 등)를 활용하여 다른 탭의 데이터를 캡처하는 방식으로 구현되었으며, 하위 호환성을 보장하여 V1 백업 파일도 정상적으로 불러올 수 있습니다.

**백업 복원 시 화면 상태(UI State) 불일치 버그 완벽 수정 (activeGrade 보존):**
- 사용자가 1학년 데이터를 업로드하고 백업을 저장한 뒤 복원할 때, 화면이 디폴트인 '2학년' 탭으로 돌아가면서 '선택된 파일 없음'으로 표기되어 데이터가 유실된 것처럼 보이던 치명적인 사용자 착각(UX 버그)을 완벽하게 해결했습니다.
- 백업 저장 시 현재 활성화된 학년(`activeGrade`, `changeActiveGrade`) 상태를 JSON에 포함하고, 복구 시 해당 학년 탭으로 즉시 자동 전환되도록 로직을 추가했습니다.

**백업 데이터 병합(Spread) 초기화 누락 보완:**
- 백업 파일을 불러올 때 특정 학년 데이터가 누락된 경우 `undefined`가 덮어씌워지던 문제를 방지하기 위해, 모든 상태 복구 로직(`setUploadedFiles`, `setRawSheetData` 등)에 `{ pre1: null, grade1: null, grade2: null, ...parsedData }`처럼 완전한 초기값을 명시하여 견고함을 강화했습니다.

### 2026-07-11
**과목 변경 신청 (교환 로직) 최적화 (인원 균등화 우선순위 개선):**
- 기존의 탐욕적(Greedy) 선택 방식이 연쇄적인 과목 변경을 방해하여, 인원 균등화 옵션을 켰을 때 정상적인 과목 변경이 "불가" 처리되는 문제를 해결했습니다.
- DFS(깊이 우선 탐색) 기반의 전체 시퀀스 최적화 알고리즘으로 전면 교체하여, 학생의 과목 변경 "성공 횟수"를 1순위로 극대화하고, "반 인원 편차 최소화"를 2순위로 적용하도록 최적화했습니다. 이를 통해 균등화를 활성화해도 원래 가능했던 변경이 실패하지 않도록 보장합니다.

**4단계 & 6단계 로스터 뷰 빈 강의실 렌더링 버그 수정:**
- `전체 과목 (타임별)` 필터 적용 시, 해당 타임에 배정된 과목이 없는 빈 강의실(예: 2-2) 열이 표에서 아예 사라지는 버그를 수정했습니다. 조건문을 제거하여 어떤 타임이든 모든 개설 강의실 컬럼이 항상 화면에 렌더링되도록 수정했습니다.

**6단계 출석부용 엑셀 다운로드 (가로 데이터) 기능 추가:**
- 기존 세로형 명단 외에 실제 교육 현장의 출석부 양식에 맞춘 가로형 엑셀 다운로드(`출석부 표지 명단(X학년).xlsx`)를 새롭게 추가했습니다.
- 열 구조를 `[학년] [반] [A타임..등 타임별 과목명] [교사] [타임] [과목] [1..34 (이름)] [학번1..34 (학번)]` 형태로 가공하고, 동적으로 생성되는 34칸의 빈칸 채우기 로직을 적용했습니다.
- 정렬 기준을 1순위: '학반' 오름차순, 2순위: '타임' 알파벳 오름차순으로 세팅하여 출력물의 가독성과 정리 효율을 극대화했습니다.
