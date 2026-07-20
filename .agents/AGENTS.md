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

- **DB: Prisma + SQLite** (`@prisma/adapter-better-sqlite3` 드라이버 어댑터 사용). Postgres 같은 별도 컨테이너 없이 파일 하나(`dev.db`, 프로덕션은 `DATABASE_URL`이 가리키는 경로)로 끝나서 기존 NAS/Docker 배포 방식과 잘 맞습니다.
  - **Prisma 7 문법 주의:** 이 버전은 `generator client { provider = "prisma-client" }` (구버전 `prisma-client-js` 아님)를 쓰고, 생성된 클라이언트를 `src/generated/prisma`에 출력합니다(스키마 파일의 `output` 참고, `.gitignore`에 이미 등록됨). **드라이버 어댑터가 필수**라 `new PrismaClient()`를 인자 없이 호출하면 타입 에러가 납니다 — 반드시 `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) })` 형태로 써야 합니다(`src/lib/prisma.ts` 참고).
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
- **`src/proxy.ts`** (Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었고 **기본적으로 Node.js 런타임에서 실행**됩니다 — 이 프로젝트처럼 better-sqlite3 같은 네이티브 모듈을 인증 체크에서 써야 하는 경우 핵심적인 변화입니다. Edge 런타임이었다면 애초에 동작하지 않았을 것). `/apps/schedule-helper/:path*`를 매칭해서 `login`/`signup` 경로를 제외한 나머지에 세션이 없으면 로그인 페이지로 리다이렉트합니다. 허브·`enrollment-helper`는 이 matcher에 안 걸리므로 영향 없습니다.
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

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` 세 환경변수가 반드시 필요합니다(`.env.example` 참고). `BETTER_AUTH_SECRET`은 `npx auth secret`으로 생성.
- SQLite 파일(`DATABASE_URL`이 가리키는 경로)이 Docker 볼륨에 영속되도록 마운트해야 합니다 — 컨테이너 재시작마다 계정/학교 데이터가 날아가면 안 됩니다.
- 배포 파이프라인에 `npx prisma migrate deploy`(dev 전용인 `migrate dev` 아님)를 빌드/배포 스텝에 추가해야 마이그레이션이 실제 서버에도 적용됩니다. 아직 CI/배포 스크립트에 반영 안 되어 있으니, 실제 배포 전에 반드시 추가하세요.

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
