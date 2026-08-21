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
  - **`exam-scheduler`** (교육평가부) — 시험 시간표 작성 도우미. 명단→시간표→시험실 배정→분반→자습 배정→결과 출력 5단계 마법사. 별도 로컬 Next.js 프로젝트(`Documents/dev/exam-scheduler`, DB/인증 없음)를 통째로 이 저장소 안에 포팅한 것 — schedule-helper와 같은 패턴입니다. 자세한 내용은 아래 "🎓 별도 앱 통합(exam-scheduler) 참고 메모" 섹션 참고.

**`AppSwitcher` — 같은 부서 앱 사이를 오가는 헤더 드롭다운 (2026-08-06 추가)**: `src/features/schedule-helper/components/AppSwitcher.tsx`. 예전에는 각 앱 헤더에 "○○로 이동" 링크를 손으로 하나씩 넣었는데, 앱이 3개가 되자 헤더가 길어지고 **한 화면에만 링크를 빠뜨리는 일**이 실제로 생겼습니다(시간표 교체 도우미에 "업무 AI 파트너" 링크가 없었음). 지금은 현재 앱 이름이 적힌 버튼 하나에 마우스를 올리면 같은 부서 앱 전체가 펼쳐집니다. **목록은 `src/config/hub.ts`에서 직접 읽으므로, 새 앱을 허브에 등록하면 모든 화면의 드롭다운에 자동으로 나타납니다 — 헤더를 손볼 필요가 없습니다.** 현재 앱은 `usePathname()`과 가장 길게 겹치는 `href`로 판정합니다(`/apps/schedule-helper`와 `/apps/schedule-helper/certificates`가 둘 다 걸리므로 최장 일치가 필요). 호버뿐 아니라 클릭으로도 열리고(터치 기기), 바깥 클릭·Esc로 닫힙니다. `tone` prop으로 teal(시간표·이수증) / amber(업무 AI 파트너) 배색을 맞춥니다.

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
- **better-auth가 자동 생성/관리하는 `User`/`Session`/`Account`/`Verification`** — `npx auth generate`가 스키마 파일에 직접 써넣은 모델입니다. **이 네 모델은 손으로 편집하지 말고 항상 `npx auth generate`로 재생성하세요** — CLI가 이 블록을 통째로 다시 쓰기 때문에, 수동으로 추가한 `@relation` 같은 필드는 다음 `generate` 때 사라질 수 있습니다. 그래서 의도적으로 `User.schoolId`/`User.teacherId`는 Prisma `@relation` 없이 평범한 문자열 필드로만 두었고, 관련 School/Teacher를 찾을 땐 그냥 `prisma.school.findUnique({ where: { id: user.schoolId } })`처럼 수동 조회합니다. **`User.loginId: String?`(2026-07-23 추가)** — 이메일이 아닌 아이디 로그인용, `@@unique([schoolId, loginId])`(nullable이라 기존 이메일 가입자는 전부 `null`로 남아도 서로 충돌하지 않음). 이 저장소에 `npx auth generate`용 CLI 바인이 현재 설치돼 있지 않아(`node_modules/.bin`에 없음) 다른 additionalField들과 동일하게 스키마에 손으로 추가했습니다 — `@relation` 없는 평범한 문자열이라 위 경고("CLI가 재생성 시 사라짐")의 대상은 아닙니다.

### 라우팅 & 인증 게이트

- `src/app/apps/schedule-helper/(app)/` — **route group**. `layout.tsx`(폰트 + `<ScheduleProvider>`)와 기존 `page.tsx`, `teachers/page.tsx`가 여기 있습니다. `(app)`는 URL에 나타나지 않으므로 여전히 `/apps/schedule-helper`, `/apps/schedule-helper/teachers`로 접근합니다.
- `src/app/apps/schedule-helper/login/page.tsx`, `signup/page.tsx` — **`(app)` 밖에** 있습니다. 로그인 전 페이지에서 `ScheduleProvider`가 불필요한 `/api/schedule` 요청을 쏘지 않게 하려는 의도적인 분리입니다.
- **`src/proxy.ts`** (Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌었고 **기본적으로 Node.js 런타임에서 실행**됩니다 — SQLite였을 때는 better-sqlite3 네이티브 모듈 때문에 Edge 런타임이었다면 애초에 동작하지 않았을 결정적인 이유였고, Postgres로 바꾼 지금도(`pg`는 순수 JS라 Edge에서도 돌아갈 수 있음) Prisma 클라이언트 자체가 Node API에 기대는 부분이 있어 Node 런타임을 유지하는 게 안전합니다). `/apps/schedule-helper/:path*`를 매칭해서 `login`/`signup` 경로를 제외한 나머지에 세션이 없으면 로그인 페이지로 리다이렉트합니다. 허브·`enrollment-helper`는 이 matcher에 안 걸리므로 영향 없습니다. **로그인 후 원래 있던 앱으로 복귀 (2026-07-23 추가)**: 두 서브앱(시간표 교체 도우미 `/apps/schedule-helper`, 연수 이수증 수거 `/apps/schedule-helper/certificates`)이 같은 세션 쿠키를 공유하므로 로그인은 한 번만 하면 되지만, 예전엔 로그인 후 목적지가 `/apps/schedule-helper`로 고정돼 있어 이수증 수거 쪽에서 로그인/재로그인해도 항상 교체 도우미로 튕겨나가는 문제가 있었습니다. `proxy.ts`가 미인증 리다이렉트 시 원래 요청 경로를 `?next=`에 실어 보내고(`loginUrl.searchParams.set("next", pathname)`), 두 페이지의 `handleLogout`도 로그아웃 후 이동할 때 자기 자신의 경로를 `next`로 명시합니다. `login/page.tsx`는 `useSearchParams()`로 `next`를 읽어 로그인 성공 시 그리로 `router.push` — 단 `resolveNextPath()`가 `next`값이 `"/apps/schedule-helper"`로 시작하는지 검증하고 아니면 기본값으로 폴백해 **오픈 리다이렉트를 차단**합니다(쿼리 파라미터는 사용자가 URL로 조작 가능한 신뢰 불가 입력이므로). `useSearchParams()`를 쓰는 클라이언트 컴포넌트라 `<Suspense>`로 감싸야 하는 Next App Router 제약 때문에 실제 폼은 `LoginForm`으로 분리하고 `LoginPage`가 그걸 `Suspense`로 감쌉니다.
- 가입 흐름: "학교 만들기"(`POST /api/schedule-helper/schools` — School 생성 + joinCode 발급 + admin 계정 생성, 이메일 중복 등으로 계정 생성이 실패하면 방금 만든 School을 롤백 삭제) / "코드로 가입"(`POST /api/schedule-helper/join` — joinCode로 School을 찾아 TEACHER 계정 생성). 둘 다 `src/app/apps/schedule-helper/signup/page.tsx`의 탭 토글 UI에서 호출합니다.
- **관리자 직접 계정 발급 + 아이디(이메일 아님) 로그인 (2026-07-23 추가)**: 위 셀프가입 방식과 별개로, 관리자가 교사 대신 계정을 만들어 아이디+비밀번호를 나눠줄 수 있습니다. **핵심 제약**: better-auth의 `signIn.email`/`signUp.email`은 서버에서 `z.email()`을 강제해서 이메일 형식이 아닌 문자열로는 그 경로를 못 씁니다. better-auth 공식 `username` 플러그인도 있지만 **전역 유일성**만 지원해 "아이디는 학교 안에서만 유일하면 됨"이라는 요구와 안 맞아 채택하지 않았습니다. 대신 `User.loginId`(학교 안에서만 유일, **2026-07-24부터 한글도 허용** — `LOGIN_ID_REGEX`에 `가-힣` 추가)를 실제 이메일이 아닌 내부 합성 이메일에 매핑합니다. **합성 이메일은 `${userId}@login.internal`**(`synthesizeEmail()`, 2026-07-24 변경 — 원래는 `${loginId}.${schoolId}@login.internal`이었는데, 아이디에 한글을 허용하면서 z.email() 정규식이 로컬파트에 비ASCII 문자를 절대 허용하지 않는다는 걸 재확인해(`zod`의 email 정규식 직접 확인) 아이디 문자 자체를 이메일에 절대 넣지 않도록 바꿨습니다. userId(cuid)는 항상 ASCII·전역 유일이라 아이디에 어떤 문자가 들어와도 안전합니다 — 로그인 라우트가 `(schoolId, loginId)`로 먼저 User 행을 찾아 저장된 이메일을 그대로 쓰므로, 이메일을 아이디 문자열로부터 재계산할 필요가 없다는 점을 이용했습니다). **계정 생성은 `auth.api.signUpEmail`을 쓰지 않습니다** — better-auth의 `nextCookies()` 플러그인이 그 호출 즉시 새로 만든 계정으로 로그인 세션 쿠키를 덮어써버려서, 관리자가 방금 만든 교사 계정으로 로그인 상태가 바뀌어버리는 실제 버그를 겪었습니다(디스포저블 테스트로 재현·확인). 그래서 `createLoginIdAccount()`(`src/features/schedule-helper/lib/loginId.ts`)가 `better-auth/crypto`의 `hashPassword`(better-auth가 실제 로그인 검증 때 쓰는 것과 완전히 같은 해시 포맷)로 직접 해시하고 `User`+`Account`(providerId `"credential"`)를 Prisma로 직접 생성합니다 — 관리자의 세션이 그대로 유지됩니다. **로그인은 `POST /api/schedule-helper/login-id`**(공개 라우트, body `{schoolId, loginId, password}`)가 `(schoolId, loginId)`→User 행(그리고 그 안에 저장된 합성 이메일)을 찾은 뒤 `auth.api.signInEmail`을 그대로 호출해 검증된 해시 비교·세션 발급을 위임합니다(이건 신규 계정을 만드는 게 아니라 기존 계정에 로그인하는 것뿐이라 세션 쿠키 문제 없음). 로그인 화면(`login/page.tsx`)엔 "이메일로 로그인"/"아이디로 로그인" 토글이 있고, 아이디 모드는 **학교 코드 대신 학교를 검색해서 선택**(2026-07-24 변경 — "학교 코드는 결국 학교를 구분하려는 용도인데 그냥 검색해서 고르면 되지 않냐"는 지적으로 교체)+아이디+비밀번호를 받습니다. 학교 검색은 신규 공개 라우트 `GET /api/schedule-helper/schools/search?q=`(세션 불필요, `School.name` 부분 일치, `{id,name}`만 반환 — `joinCode` 등 민감 정보 노출 없음)를 씁니다. 기존 `School.joinCode`는 여전히 존재하며 "코드로 가입"(이메일 셀프가입) 흐름에만 쓰입니다. **엑셀 일괄 생성**은 `POST /api/schedule-helper/teachers/accounts/bulk`(admin-only, multipart `{file, password}`)가 기존 시간표 업로드(`upload/route.ts`)와 동일한 패턴으로 `xlsx` 패키지를 서버에서 파싱(`parseAccountsWorkbook.ts`, A열=이름/B열=아이디, 1행은 머리글로 스킵)하고, 초기 비밀번호는 배치당 1개로 전체에 동일 적용하며, 행 단위로 `{created, skipped:[{name,loginId,reason}]}`를 리포트합니다(한 행이 실패해도 나머지는 계속 생성). 관리 UI는 `/apps/schedule-helper/accounts`(admin-only, 단건 생성/엑셀 업로드/계정 목록+비밀번호 재설정을 한 화면에). **관리자 강제 비밀번호 재설정**(`POST /api/schedule-helper/teachers/accounts/[id]/reset-password`)도 같은 이유로 `auth.api`를 거치지 않고 `hashPassword` + Prisma 직접 갱신 방식입니다(better-auth의 `setPassword`는 "이미 비밀번호가 있으면 실패"라 이 용도로 못 씀) — 이메일이 없는 계정은 "비밀번호 찾기" 메일을 보낼 수 없어서 이 기능이 유일한 복구 경로입니다. **로그인 후 스스로 비밀번호 변경**은 better-auth 코어 내장 `/change-password`(플러그인 아님, `currentPassword`+`newPassword`)를 `authClient.changePassword(...)`로 그대로 호출(`/apps/schedule-helper/account` 페이지, 양쪽 앱 헤더에 링크). 기존 "코드로 가입"(이메일) 방식은 그대로 유지됩니다 — 둘은 서로 배타적이지 않고 같은 학교 안에 이메일 계정과 아이디 계정이 섞여 있을 수 있습니다. **전체 가입 인원 조회/삭제 (2026-07-24 추가)**: `GET /api/schedule-helper/members`(admin-only)가 이메일 계정+아이디 계정을 가리지 않고 그 학교의 `User` 전체를 반환하고, `/apps/schedule-helper/accounts` 페이지 상단 "전체 가입 인원" 카드가 이를 나열합니다(로그인 방식/역할 배지, 본인 행은 "(나)" 표시 후 삭제 버튼 숨김). `DELETE /api/schedule-helper/members/[id]`(admin-only)는 대상이 같은 학교 소속인지, 본인이 아닌지, 학교의 마지막 ADMIN이 아닌지 확인한 뒤 `prisma.user.delete()`만 호출합니다 — `Session`/`Account` 모두 스키마에서 `onDelete: Cascade`로 `User`에 연결돼 있어 별도로 지울 필요가 없습니다.

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

- Postgres는 `~/docker/subject-selector-db/docker-compose.yml`(**`pgvector/pgvector:pg16`, 2026-08-06에 `postgres:16-alpine`에서 교체**)로 별도 컨테이너로 띄워져 있습니다. 교체 이유와 절차는 아래 "pgvector 전환" 항목 참고. **NAS 전체 앱(`~/docker/my-webapp/`, `Dockerfile`/`docker-compose.yml`/`deploy.sh`)은 2026-07-21부로 잠정 중단 상태** — 코드는 남아있지만 실제로 그 경로에 최신 앱을 배포해서 쓰고 있진 않습니다. 나중에 다시 쓰게 되면 NAS 앱과 NAS DB가 같은 머신에 있으니 `DATABASE_URL`을 `postgresql://...@192.168.0.21:55432/...`처럼 로컬 LAN IP로 바로 잡으면 되고, 외부 도메인/포트포워딩은 필요 없습니다.
- **포트 포워딩**: 라우터에서 외부 TCP `55432` → `192.168.0.21:55432`. 도메인은 DuckDNS(`fbalswp.duckdns.org`)를 씁니다. Vercel의 `DATABASE_URL`은 이 외부 주소(`fbalswp.duckdns.org:55432`)를 가리키고, **로컬 개발 환경의 `DATABASE_URL`은 같은 LAN이므로 포트포워딩을 거치지 않고 `192.168.0.21:55432`로 직접 접속**합니다 — 두 값이 다른 게 정상입니다.
- DB 비밀번호는 `openssl rand -hex 20`으로 생성했고, NAS의 `docker-compose.yml`(POSTGRES_PASSWORD)과 로컬 `.env`, Vercel의 `DATABASE_URL` 세 곳에 각각 반영되어 있어야 동기화가 맞습니다. 바꿀 일이 있으면 이 세 곳을 다 갱신하세요.
- 데이터 영속화: `~/docker/subject-selector-db/data`가 Postgres의 실제 데이터 디렉토리(볼륨 마운트) — 컨테이너를 지우고 다시 만들어도 이 폴더만 살아있으면 데이터는 유지됩니다.

### pgvector 전환 — 2026-08-06

"업무 AI 파트너"의 자료 검색이 벡터 유사도에 의존해서 Postgres 이미지를 `postgres:16-alpine` → `pgvector/pgvector:pg16`으로 바꿨습니다. **이미지만 바꿔 끼우지 않고 반드시 덤프 → 복원으로 갔습니다.**

- **이유(중요)**: 기존 클러스터는 alpine(musl) 위에서 `en_US.utf8`로 initdb됐는데, musl은 로케일을 사실상 구현하지 않아 정렬이 C와 같게 동작합니다. pgvector 이미지는 Debian(glibc)이라 같은 이름의 로케일이 진짜 언어별 정렬로 바뀝니다. 데이터 디렉터리를 그대로 물려주면 기존 텍스트 인덱스가 실제 정렬 순서와 어긋나 조회가 조용히 틀릴 수 있습니다. **앞으로도 alpine ↔ debian 사이로 Postgres 이미지를 옮길 때는 무조건 `pg_dump` → 새 볼륨 → 복원 순서를 지키세요.**
- 실제로 밟은 순서: `pg_dump`(평문) → `docker compose down` → `mv data data.alpine-backup`(지우지 않고 보관) → 이미지 교체 → `up -d` → `psql < 덤프` → `CREATE EXTENSION vector;`. 되돌리려면 이미지를 되돌리고 `data.alpine-backup`을 `data`로 되돌리면 됩니다.
- **복원 시 `| tail -N`으로 출력을 자르지 마세요.** 이번에 그것 때문에 에러가 가려져 "복원 실패"로 오판했습니다. `psql -v ON_ERROR_STOP=1`을 붙이고 출력을 그대로 보세요. 경로도 상대경로 대신 절대경로를 쓰는 게 안전합니다.
- 확장 설치는 마이그레이션에도 들어 있습니다(`20260806105107_add_assistant_models/migration.sql` 첫 줄 `CREATE EXTENSION IF NOT EXISTS vector;`) — 새 환경에 배포할 때 확장이 없어 `vector(768)` 컬럼 생성이 실패하는 걸 막기 위한 것입니다.

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

- **5개 탭과 접근 범위 (2026-07-23 탭 개편, 같은 날 권한 완화 후속 수정 포함)**: **연수목록 관리**(첫 번째 탭, 로그인 전원 노출, 내부에 3개 서브 메뉴 — 아래 항목 참고, "새 연수 등록"과 "명단 프리셋 만들기" 둘 다 로그인한 아무나 가능) / 제출하기(로그인 전원, 본인 이름은 `resolveTeacherName(session.user)`로 서버가 강제 — 클라이언트가 이름을 자유 입력할 수 없어 스푸핑 불가) / 내역조회(관리자는 전체 검색, **일반 교사는 본인 제출 내역 + 본인이 등록한 연수(`registeredByName`)에 다른 교사가 제출한 내역까지 함께 봄** — "누가 등록했는지"와 "누가 제출했는지"가 별개 권한이라, 등록자는 자기 연수의 제출 현황을 알아야 한다는 요청으로 2026-07-23 확장. 단 삭제 버튼은 여전히 본인 제출 건에만 노출 — 등록자라고 남의 제출을 지울 권한은 아님) / 일괄확인(관리자 또는 해당 연수의 등록자만 — 이제 그 연수에 등록된 전용 명단 기준으로 제출/미제출 계산, 아래 `TrainingTitle` 참고) / 서명받기 QR(admin-only 탭, 세션 자체는 원본 그대로 **완전 익명** 유지 — 세션 cuid 자체가 유일한 접근 통제라는 트레이드오프를 사용자가 명시적으로 승인함).
- **`resolveTeacherName(user)`** (`src/features/schedule-helper/lib/resolveTeacherName.ts`) — `user.teacherId`가 있으면 그 `Teacher.name`, 없으면 `user.name` 폴백. 제출/내역조회/일괄확인/연수삭제/연수 전용 명단 편집 전부 이 헬퍼로 신원을 서버에서 재확인하고, 클라이언트가 보낸 이름은 절대 신뢰하지 않습니다.
- **`TrainingTitle` 레지스트리 + 연수 전용 참여명단 + 이수증/서명 카테고리 분리 (2026-07-23)**: "연수 제목"은 자유 텍스트가 아니라 사전 등록제입니다. 로그인한 아무나 새 연수를 등록할 수 있고(`POST /api/schedule-helper/certificates/training-titles`, `@@unique([schoolId, title])`), 등록된 연수는 전 교사가 제출 가능(`submit`이 등록 여부를 검사, 미등록 연수 제출 시 400)합니다. 등록 시 그 연수 전용 참여명단(`rosterSnapshot: String?`, JSON string[], 순서 보존)을 함께 지정할 수 있고 — null이면 `getCertificateRoster()` 전체 기본 명단으로 폴백합니다. **`category: String @default("certificate")`**("certificate" | "sign")로 이 연수가 이수증 제출용인지 QR 서명용인지 구분합니다 — 사용자가 직접 고르는 필드가 아니라, 관리 화면의 어느 서브 메뉴에서 만들었는지로 서버가 자동 태깅(`body.category === "sign" ? "sign" : "certificate"` coercion, 사용자 입력 검증 아님). 이 분리 덕에 제출하기 탭(`TrainingTitleSelect.tsx`)은 `category === "certificate"`만, 서명받기 탭(`TrainingTitleMultiSelect.tsx`)은 `category === "sign"`만 필터링해서 보여줍니다(같은 `useTrainingTitles()` 훅으로 전체를 받아 각자 클라이언트에서 필터 — 서버 쿼리 파라미터 추가 없음). **일괄확인 조회·삭제·명단 편집(`PATCH .../training-titles/[id]`)은 관리자 또는 그 연수를 등록한 본인(`registeredByName`)만 가능**. 관리 UI는 `TrainingListManager.tsx`("연수목록 관리" 탭 본문 — 이수증 수거 관리/서명 연수 관리/명단 프리셋 관리 3개 서브 탭을 갖는 얇은 컨테이너)가 `TrainingTitleManager.tsx`(`category` prop을 받아 그 카테고리만 필터링해 보여주는 재사용 컴포넌트, `RosterTable` edit 모드 + "프리셋에서 바로 불러오기" 칩 버튼)를 카테고리별로 두 번 렌더링합니다. `TrainingTitleSelect.tsx`(제출하기 탭)는 순수 검색·선택 콤보박스입니다 — 예전엔 여기서도 인라인으로 새 연수를 등록할 수 있었지만, 등록은 반드시 명단·카테고리와 함께 이뤄지도록 "연수목록 관리" 탭으로 일원화하면서 인라인 등록 기능을 제거했습니다.
- **파일/서명 저장**: `TrainingCertificate.fileBytes`, `SignSessionSignature.signaturePng` 모두 Prisma `Bytes`(Postgres `bytea`)로 행에 직접 저장, 별도 오브젝트 스토리지 없음. 스트리밍 라우트(`[id]/file`, `signatures/[id]/image`)는 `NextResponse`에 raw `Buffer` 바디 + `Content-Type`/`Content-Disposition: inline` 헤더. **`Cache-Control`은 반드시 `private, no-cache`** — 한 번 `max-age=31536000, immutable`로 뒀다가, 같은 브라우저 탭에서 로그아웃 후 다른 교사로 로그인하면 브라우저 캐시가 이전 교사의 파일을 그대로 서빙하는 실제 위험을 발견해 고쳤습니다. 새로운 bytea 스트리밍 라우트를 추가할 때 이 캐시 헤더를 그대로 복사하세요. 제출 내역은 `DELETE /api/schedule-helper/certificates/[id]`(본인 또는 관리자)로 삭제 가능 — `fileBytes`가 행 자체에 저장돼 있어 행 삭제만으로 첨부파일도 함께 지워집니다.
- **Gemini API 키**: 개발자 env var가 아니라 `School.geminiApiKey`(평문, `joinCode`와 동일한 신뢰 수준)에 학교 관리자가 직접 등록(`gemini-key` GET/PATCH, admin-only). `lib/gemini.ts`의 `analyzeCertificateImage`는 순수 `fetch` 기반 Gemini 2.5 Flash 호출이고, 실패해도 제출 자체를 막지 않고 `extractionFailed: true`로 수동 입력 폴백을 유도합니다.
- **QR 서명(`SignSession`/`SignSessionSignature`) 익명 라우트**: `sessions/[id]` GET과 `sessions/[id]/sign` POST는 로그인 검사가 **의도적으로 없습니다** — QR/URL을 아는 사람이면 누구나 로스터의 이름으로 서명 가능한, 원본 앱과 동일한 트레이드오프입니다. `src/proxy.ts`의 `PUBLIC_PATHS`에 `/apps/schedule-helper/certificates/sign`이 등록되어 있어야 이 페이지가 로그인 리다이렉트를 안 탑니다 — 나중에 "로그인 요구"로 되돌리는 방향의 수정은 이 설계를 깨는 것이니 하지 마세요. `SignSessionSignature`는 지금도 세션당 교사 1명당 1행뿐입니다(`sessionId+teacherName` unique, `trainingTitle` 필드 없음 — 원본 `Code.gs`의 `submitSignature`가 그룹의 모든 연수 시트에 동일 서명을 씀을 재확인하고 스키마에서 제거한 이력, 아래 2026-07-22 로그 참고). **2026-07-23부터 "적용 범위"는 인쇄 시점에 연수별로 분리됩니다**: 세션 생성 시 각 연수 제목의 `TrainingTitle.rosterSnapshot`을 스냅샷해 `SignSession.titleRosters`(JSON `Record<제목, string[]>`)에 저장해두고, 인쇄 라우트(`sessions/[id]/print`)가 요청된 제목 인덱스에 대해 `titleRosters[제목]`으로 걸러서 그 연수 해당자만 출력합니다 — 서명 자체는 여전히 세션당 1행이지만 "누구에게 적용되는지"는 연수별 명단 교집합으로 계산되는 구조입니다. 관리자가 "참여 명단"에서 전체 기본/프리셋을 명시적으로 고르면 `titleRosters`가 null로 남아 모든 연수에 동일 명단이 적용되는 기존 동작 그대로입니다(회귀 없음).
- **스키마**: `School.geminiApiKey`, `TrainingTitle`(`id/schoolId/title/registeredByName/rosterSnapshot/category/createdAt`), `TrainingCertificate`(`teacherName/trainingTitle/number/institution/certDate/fileName/mimeType/fileBytes`), `SignSession`(`trainingTitles`/`rosterSnapshot`는 JSON string[], `titleRosters`는 JSON Record, `rosterPresetName`, `locked`), `SignSessionSignature`(`sessionId+teacherName` unique), `CertificateRosterExtra`(아래 항목 참고), `CertificateRosterPreset`(아래 항목 참고). 관련 마이그레이션 7개: `add_training_certificates`, `simplify_sign_session_signature`(그룹서명 스키마 교정), `add_training_title_registry`, `add_certificate_roster_extra`, `add_certificate_roster_preset`, `add_training_title_and_session_roster_split`, `add_training_title_category`.
- **`CertificateRosterExtra` — 시간표에 없는 인원 보충 명단 (2026-07-22 추가)**: 일괄확인/서명 세션의 "전체 대상자" 명단은 원래 `Teacher` 테이블(=시간표 업로드 시 자동 upsert된 이름)만 봤는데, 행정직원처럼 애초에 시간표가 없는 사람을 넣을 방법이 없다는 문제가 나와서 추가했습니다. `Teacher` 테이블에 직접 끼워 넣는 대신 **완전히 별도의 명단**으로 분리한 이유: 시간표 교체 도우미(SwapTab)의 교사 목록은 `Teacher` 테이블이 아니라 `School.scheduleData.teachers`(파싱된 시간표 JSON)를 기준으로 하므로, `Teacher`에 시간표 없는 사람을 추가해도 스왑 화면에는 안 나타나 실질적으로는 안전하지만, 사용자가 "연수 이수증 기능 전용 별도 명단"을 명시적으로 선택했습니다(교사 목록 관리 화면에 뒤섞이지 않게). `src/features/schedule-helper/lib/getCertificateRoster.ts`가 `Teacher.name`과 `CertificateRosterExtra.name`을 합쳐 정렬된 전체 명단을 반환하는 단일 창구 — 새로운 "전체 대상자" 조회가 필요해지면 `prisma.teacher.findMany`를 직접 쓰지 말고 이 헬퍼를 재사용하세요. 관리 UI는 `ExtraRosterSettings.tsx`(관리자 전용, `BulkCheckTab.tsx` 상단에 렌더링) — 추가/삭제 모두 admin-only, `Teacher`/기존 `CertificateRosterExtra`와 이름이 겹치면 400.
- **`CertificateRosterPreset` — 용도별로 저장해 재사용하는 이름 붙은 명단 (2026-07-23 추가)**: `CertificateRosterExtra`(항상 기본 명단에 합산되는 flat 목록)와는 별개로, "전체 교직원", "부장단만" 같은 **이름 붙인 순서 있는 명단**을 저장해두고 QR 세션 생성 시 재사용하는 기능입니다. `names: String`(JSON string[], **재정렬 안 함 — 저장된 순서가 곧 서명부 순서**), `@@unique([schoolId, name])`, `createdBy: String`(생성자 이름, `resolveTeacherName`). CRUD는 `api/.../certificates/roster-presets/{route.ts, [id]/route.ts, base/route.ts}` — **처음엔 전부 admin-only였다가, "일반 교사도 프리셋을 만들 수 있어야 한다"는 요청으로 2026-07-23에 완화**: 조회(GET)/생성(POST)/`base`(기본 명단 조회)는 로그인한 아무나 가능, 수정(PATCH)/삭제(DELETE)는 관리자 또는 그 프리셋을 만든 본인(`createdBy` 일치)만 가능(`TrainingTitle`의 등록자 전용 수정/삭제와 동일한 패턴). UI는 `RosterPresetManager.tsx`(`isAdmin` prop + `useSession()`으로 본인 이름을 확인해 `canEdit = isAdmin || preset.createdBy === myName`일 때만 편집/삭제 버튼 노출) + `useRosterPresets.ts`. **위치 변경(2026-07-23 재정정)**: 처음엔 "서명받기" 탭에 뒀다가, 사용자가 "프리셋 만들기도 연수목록 관리에 있는 메뉴여야 해" + "서명받기 탭에서는 삭제하자"고 정정해서 지금은 `TrainingListManager.tsx`("연수목록 관리"의 "명단 프리셋 관리" 서브 탭)에만 관리 UI가 있습니다. `SignTab.tsx`엔 `useRosterPresets()`로 읽어온 `presets` 목록을 "참여 명단" 셀렉트 옵션으로만 쓰는 코드가 남아있고(세션 생성 시 override 용도), 프리셋 CRUD 자체는 없습니다 — 새로 손댈 때 이 둘(관리 vs 선택)을 다시 합치지 마세요. **`RosterTable.tsx`**가 이 프리셋과 `TrainingTitleManager`(연수 전용 명단) 양쪽에서 재사용되는 공용 표 컴포넌트로, 인쇄 페이지(`sessions/[id]/print/page.tsx`)와 동일한 남색 헤더·번호/성명/서명 2단 분할 스타일을 유지하면서 `mode="edit"`일 때 네이티브 HTML5 드래그 앤 드롭 재정렬(신규 npm 패키지 없음 — 좌우 2단 분할과 무관하게 항상 flat 배열 인덱스 기준으로 재배치)을 지원합니다. 새 프리셋/연수 명단을 만들 때 시작값은 `roster-presets/base`(=`getCertificateRoster()`)에서 받아옵니다.

---

## 🤖 업무 AI 파트너(assistant) 참고 메모 — 2026-08-06 추가

`/apps/schedule-helper/assistant`. 선생님이 자기 업무 자료(PDF·DOCX·엑셀·텍스트)를 올려두면 **그 자료만 근거로** 답하는 챗봇을 만드는 기능입니다. 한 계정이 챗봇을 여러 개 만들 수 있고, **챗봇마다 자기 자료함만 검색**합니다("업무 하나 = 챗봇 하나 = 자료함 하나"). 색은 이수증 수거(teal)와 구분되도록 수강신청 도우미와 같은 크림/앰버 톤을 씁니다.

- **설계의 축은 "환각 방지"입니다.** 기재요령 같은 문서는 틀린 답이 곧 업무 사고입니다. 그래서 (1) 답변마다 근거 자료·쪽수를 칩으로 붙이고, (2) 자료에서 못 찾으면 "올려주신 자료에서는 확인할 수 없습니다"라고 답하도록 강제하며, (3) 그렇게 답한 경우 근거 칩을 자동으로 비웁니다(근거 없다는 답 옆에 근거가 붙으면 오해를 부름). 이 규칙은 `lib/assistant/chat.ts`의 `GROUNDING_RULES`에 있고, **사용자가 정한 말투(`persona`)보다 항상 뒤에 붙여** 덮어쓰지 못하게 합니다 — 순서를 바꾸지 마세요.
- **검색은 RAG**입니다. 전체 문서를 매번 프롬프트에 넣는 방식은 200쪽 PDF 기준 질문당 수백 원이 들고 느려서 배제했습니다. 업로드 → 텍스트 추출(쪽수 보존) → 조각 → 임베딩 → 질문 시 상위 8조각만 사용.
- **`lib/assistant/search.ts`가 pgvector를 만지는 유일한 파일입니다.** Prisma는 vector 타입을 못 다뤄 스키마에서 `Unsupported("vector(768)")`로 선언했고, 삽입·임베딩 채우기·유사도 검색 모두 이 파일의 raw SQL이 담당합니다. 검색 방식을 바꾸게 되면 여기만 갈아끼우면 됩니다. 조각 id는 Prisma를 거치지 않으므로 DB의 `gen_random_uuid()::text`로 만듭니다. **DB가 NAS 원격이라 항상 한 문장에 여러 행을 몰아 처리**합니다(루프 안 개별 INSERT 금지 — 위 2026-07-21 upload 타임아웃 교훈과 같은 이유).
- **분석은 잘라서 진행합니다.** Vercel 함수 60초 제한 때문에 `/documents/[docId]/ingest`가 호출 한 번에 "텍스트 추출+조각 저장" 또는 "임베딩 60개 채우기"만 하고 진행률을 돌려주며, 화면이 `ready`/`failed`가 될 때까지 반복 호출합니다. 큐 서버가 없는 대신 진행률 표시가 공짜로 따라옵니다. 새 문서 형식을 추가할 때도 이 구조를 유지하세요.
- **Gemini 키는 새로 만들지 않고 `School.geminiApiKey`를 그대로 재사용**합니다(이수증 수거와 동일). 채팅 `gemini-2.5-flash`, 임베딩 `gemini-embedding-001`(`outputDimensionality: 768`).
- **실측으로 알아낸 것 두 가지 (재현 확인함, 다시 밟지 마세요)**:
  1. **Gemini의 SSE는 이벤트 구분자로 CRLF(`\r\n\r\n`)를 씁니다.** `"\n\n"`으로 split하면 이벤트가 하나도 안 나뉘어 답변이 통째로 버퍼에 갇히고 빈 응답이 됩니다. `chat.ts`는 버퍼 전체를 매번 `\r\n → \n`으로 정규화한 뒤 자릅니다.
  2. **Gemini 임베딩은 유사도 기준선이 매우 높습니다** — 전혀 무관한 두 문장("학교폭력 조치사항 삭제 시기" ↔ "오늘 점심 메뉴")도 코사인 0.73이 나옵니다. 그래서 근거 칩 선별에 **절대 임계값을 쓰면 안 되고**, "가장 잘 맞은 조각과의 차이"라는 상대 기준(`CITATION_MARGIN`)을 씁니다.
- **일시적 오류와 영구 실패를 반드시 구분하세요 (2026-08-06 후속 수정)**: 처음엔 임베딩 중 어떤 오류든 자료를 `failed`로 못 박았는데, 사용자가 PDF 4개를 연달아 올리자 4번째가 Gemini 속도 제한(429)에 걸려 영구 실패로 남았습니다(파일을 지우고 다시 올리는 것 말고 방법이 없었음). 지금 구조는 (1) `embed.ts`가 429를 `RateLimitError`로 따로 던지고 서버 안에서 2·5·12초 백오프로 재시도, (2) 그래도 안 되면 ingest가 `failed`가 아니라 `status: "processing"` + `waitMs`를 돌려주고 화면이 그만큼 쉬었다 이어서 호출, (3) 모든 `failed` 자료에 "다시 분석"(`POST .../ingest?retry=1`) 버튼 — 조각이 이미 있으면 임베딩 단계부터, 없으면 추출부터 재개. **새 외부 API 호출을 추가할 때도 이 세 가지를 같이 갖추세요.**
- **Gemini 오류 메시지는 반드시 `geminiError.ts`의 `describeGeminiError()`를 통과시켜 한국어로 바꿔 보여주세요.** 원문을 그대로 노출하면 선생님 화면에 "You exceeded your current quota, please check your plan and billing details..." 같은 영어가 그대로 뜹니다(실제로 그렇게 나갔던 이력).
- **권한**은 이수증 수거와 같은 모델(만든 사람이 곧 관리자)이고 `lib/assistant/access.ts`의 `loadBotAccess()` 한 곳에서만 판정합니다. `visibility`(`private`/`school`) 필드는 스키마에 미리 넣어두고 **1단계에서는 서버가 항상 `private`으로 고정**합니다 — 학교 공개 기능을 열 때 마이그레이션 없이 값만 열면 됩니다.
- **HWP는 지원하지 않습니다.** 자바스크립트로 한글 파일을 안정적으로 읽을 방법이 사실상 없어서, 업로드 시 "PDF로 저장한 뒤 올려주세요"라는 실패 사유를 그대로 화면에 띄웁니다. 스캔본 PDF(글자 없는 이미지)도 같은 방식으로 실패 처리합니다.
- **개인정보 경고는 설정 화면에 고정 노출**입니다(올린 파일 내용이 Google로 전송되므로). 지우지 마세요.
- **스키마**: `AssistantBot` / `AssistantDocument`(원본 bytea + 분석 상태·진행률) / `AssistantChunk`(`botId` 비정규화 + `vector(768)`) / `AssistantThread` / `AssistantMessage`(`citations` JSON). 마이그레이션 `20260806105107_add_assistant_models` — 첫 줄의 `CREATE EXTENSION IF NOT EXISTS vector;`와 마지막 줄의 HNSW 인덱스(`vector_cosine_ops`)는 **Prisma가 생성해주지 않아 손으로 넣은 것**이라, 마이그레이션을 다시 만들면 빠뜨리기 쉽습니다.

---

## 🎓 별도 앱 통합(exam-scheduler) 참고 메모 — 2026-08-10 추가

`/apps/exam-scheduler`("교육평가부" 부서의 "시험 시간표 작성 도우미")는 schedule-helper와 같은 방식으로 **별도 로컬 Next.js 프로젝트(`Documents/dev/exam-scheduler`, GitHub 원격 저장소 없이 로컬에만 존재)의 소스를 통째로 이 저장소 안으로 포팅**한 것입니다. 명단 업로드 → 시험 시간표 입력 → 시험실 배정(+분반) → 자습 배정 → 결과·엑셀 출력까지 5단계로 진행하는 마법사형 도구이며, DB/로그인 없이 완전히 브라우저 안에서만 동작합니다(업로드한 명단이 서버로 전송되지 않음).

- **파일 매핑:** 원본의 `src/lib/{domain,excel,io,scheduling,store}/*` → `src/features/exam-scheduler/lib/*`(구조 그대로, 파일 내용도 로직 변경 없이 그대로), 원본의 `src/components/*.tsx`(+ barrel `index.ts`) → `src/features/exam-scheduler/components/*`, 원본의 `src/app/page.tsx` → `src/app/apps/exam-scheduler/page.tsx`(헤더에 "허브로 돌아가기" `next/link`만 추가, 나머지 동일). `layout.tsx`는 metadata(브라우저 탭 제목)와 배경색만 담당합니다 — 원본은 `body` 배경이 옅은 회색(`--color-surface-muted`)이라 흰 카드가 떠 보였는데 허브의 `body`는 흰색이라, 이 앱 라우트에서만 `bg-surface-muted`를 다시 씌워 원본 모양을 복원합니다(schedule-helper 계열이 각자 layout에서 폰트·배경을 잡는 것과 같은 패턴). **원본 `public/sample-roster-1.xlsx`/`sample-roster-2.xlsx`도 반드시 같이 복사해야 합니다** — "표본 명단으로 둘러보기" 버튼이 `fetch('/sample-roster-N.xlsx')`로 이 파일들을 직접 읽는데, 처음 포팅 때 이걸 빠뜨려서 "Can't find end of central directory" 파싱 에러가 났었습니다(404 응답 HTML을 zip으로 파싱하려다 실패).
- **import 경로:** `src/features/exam-scheduler/components/*.tsx`에서만 `@/lib/...` → `@/features/exam-scheduler/lib/...`로 고치면 됩니다. `lib` 폴더 내부 파일들은 전부 상대경로(`../domain/...` 등)로 서로를 참조하고 있어 손댈 필요가 없었습니다.
- **의존성:** `zustand@^5.0.14` 신규 추가(원본 상태관리, 허브엔 없었음). **`xlsx`를 npm 무료판(`^0.18.5`) → SheetJS CDN 풀빌드(`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, 원본과 동일 tarball)로 교체** — 결과 화면의 "시험지 봉투 표지(.xls)" 출력이 BIFF8(Excel 97-2003) 쓰기를 쓰는데, 이건 npm 무료판엔 없고 CDN 풀빌드에만 있는 기능입니다(`src/features/exam-scheduler/lib/excel/exportEnvelope.ts` 주석 참고). 허브에서 기존에 `xlsx`를 직접 쓰던 3곳(`schedule-helper`의 `extractText.ts`/`parseAccountsWorkbook.ts`/`sheetData.ts`)은 전부 **읽기 전용** 파싱이라 버전 교체로 인한 회귀는 없는 것으로 확인했습니다(쓰기는 전부 `xlsx-js-style`이나 `exceljs`를 따로 씀 — 이쪽은 안 건드림). `lucide-react`도 `^1.21.0` → `^1.28.0`으로 소폭 올렸습니다(원본이 요구하는 아이콘 세트 호환용, breaking change 없음).
- **CSS 병합:** `globals.css`에 원본의 `--color-surface`/`--color-surface-muted`/`--color-line`/`--color-ink`/`--color-ink-muted`/`--color-brand`/`--color-brand-soft` 색상 토큰과 `grid-table` `@utility`를 그대로 추가했습니다. **`--font-sans`/`--font-mono`는 의도적으로 가져오지 않았습니다** — 원본은 학교 PC 오프라인 대응으로 시스템 한글 폰트(Pretendard/맑은 고딕 등) 스택을 썼는데, 이걸 그대로 병합하면 허브의 `@theme inline` 블록이 이미 정의한 `--font-sans`(Geist)를 전역으로 덮어써 버려 허브의 다른 모든 페이지 폰트가 바뀌는 부작용이 생깁니다. exam-scheduler 화면은 이제 허브의 폰트를 그대로 상속받습니다(한글은 시스템 폴백으로 정상 렌더링, 기능상 문제 없음 — 순수 코스메틱 트레이드오프).
- **로컬 개발 시 `.env.local` 필요 (DB를 쓰지 않는데도):** exam-scheduler 자체는 Prisma/Postgres/better-auth를 전혀 안 쓰지만, **허브 프로젝트 전체가 `postinstall: prisma generate`와 `datasource db { provider = "postgresql" }`를 물고 있어서** `DATABASE_URL`이 유효한(문법상) postgres URL로라도 채워져 있지 않으면 `npm install`/`next dev`가 아예 안 뜹니다. 로컬 전용 더미 값(`.env.local`, gitignore됨)으로 `DATABASE_URL="postgresql://user:pass@localhost:5432/dev"` + 임의의 `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL="http://localhost:3000"`을 채워두면 부팅됩니다. exam-scheduler·enrollment-helper 화면은 이 값이 가짜여도 정상 동작하고, 진짜 DB가 필요한 건 로그인이 걸린 schedule-helper 계열뿐입니다.
- **인증 게이트 영향 없음:** `src/proxy.ts`의 `matcher`가 `/apps/schedule-helper/:path*`만 잡으므로 `/apps/exam-scheduler`는 enrollment-helper와 마찬가지로 로그인 없이 완전히 열려 있습니다. 새로 손댈 일 없습니다.
- **원본과의 동기화는 수동입니다 — git 이력이 이어져 있지 않은 단순 파일 복사(스냅샷)입니다.** `Documents/dev/exam-scheduler`는 계속 별도 프로젝트로 남아있고(구 버전 Python/Eel 데스크톱 앱 대조용 golden-file 테스트, vitest 스위트 등은 이 원본에만 있고 허브 쪽엔 포팅하지 않았습니다), 앞으로 그 원본에서 버그를 고치거나 기능을 추가하면 **이 저장소의 `src/features/exam-scheduler/`와 `src/app/apps/exam-scheduler/page.tsx`에 수동으로 다시 반영해야 합니다.** 자동 동기화(symlink/submodule/워크스페이스)는 없습니다 — "다른 저장소 앱을 허브에 합쳐달라"는 요청이 또 오면 이 문서의 schedule-helper 섹션과 이 섹션에서 쓴 방식(파일 매핑 → import 경로 정리 → 의존성 선별 → CSS 토큰 병합 → 인증 matcher 확인 → tsc/lint 클린 확인 → 브라우저로 전 화면 클릭 검증)을 그대로 재사용하세요.
- **검증한 것:** `npx tsc --noEmit` 클린, `npm run lint`도 새로 추가한 코드엔 에러 없음(허브의 기존 다른 기능들에 남아있던 오래된 lint 에러 162개는 이 작업과 무관하게 그대로 있음 — 손대지 않았습니다). 브라우저에서 허브 → 교육평가부 카드 → 시험 시간표 작성 도우미 → 5단계 전부 클릭 이동, "표본 명단으로 둘러보기"로 샘플 데이터 로드, `1반 1번 학생001` 형식(반 중복 표기 없음) 정상 렌더링, 콘솔 에러 없음까지 확인했습니다.

---

## 📝 보강원 작성(makeup) 참고 메모 — 2026-08-13 추가

수업교체 도우미(`SwapTab`)에서 찾은 교체·대강 후보를 **골라 담아 보강원 문서로 뽑는** 기능입니다. 예전엔 후보를 보여주기만 하고 서류는 손으로 썼습니다.

- **교체도 보강도 서식에서는 한 줄입니다 (2026-08-21 서식 입수 후 정정).** ~~교체는 두 줄로 펼친다~~던 초기 설계는 실제 서식을 받기 전의 추측이었고, **틀렸습니다.** 학교 서식의 표에는 `수업 교체의 경우만 기재 → 교체대상 교시 / 교체대상 교과` 열이 따로 있어서, "내가 대신 갈 상대 수업"이 **같은 줄 안에서** 표현됩니다. 두 줄로 적으면 교체대상 칸이 비고 같은 건이 중복돼 보입니다. 표의 의미는 이렇습니다 — 왼쪽 세 칸(교과명·학반·교시)은 **내가 못 하는 수업**, 가운데 두 칸은 **교체라면 내가 대신 갈 상대 수업**(보강이면 공란), 오른쪽은 **대신 들어와 주는 선생님**(+인). 변환은 `lib/makeup/buildRows.ts`의 `rowForEntry()` 한 곳에서만 합니다. **되돌리지 마세요.**
- **서식은 하루에 한 장입니다.** 서식 하단에 "하루에 한 장씩 기재해 주십시오"라고 인쇄돼 있고 머리말의 `일 시`도 날짜 하나뿐입니다. 그래서 `buildSheets()`가 트레이를 **결강일별로 갈라** 장을 만들고(`MakeupDoc.sheets`), 인쇄 페이지가 장마다 `break-after: page`로 끊습니다. 트레이는 여러 날을 담을 수 있게 두었습니다 — 담는 사람 입장에서 하루씩 끊어 담게 강요하는 것보다, 담아둔 걸 문서로 뽑을 때 자동으로 갈라주는 편이 낫기 때문입니다. 교체 상대의 수업이 **다른 날**인 것은 정상이고(같은 줄의 "교체대상 ( )월( )일"에 그 날짜가 들어감), 장을 가르는 기준은 어디까지나 **결강일**입니다.
- **`사 유`는 자유 입력이 아니라 서식에 인쇄된 보기 중 하나입니다** — 출장, 연가, 병가, 조퇴, 특별휴가, 기타( ). 원래 손으로 동그라미 치는 자리라, 고른 항목에 테두리를 둘러 표시하고 "기타"일 때만 괄호 안에 내용을 채웁니다. 목록은 `types.ts`의 `MAKEUP_REASONS`가 단일 소스이고 **순서까지 서식 그대로**입니다(예전 목록에 있던 `공가`는 서식에 없어 뺐고, 서식에 있는 `조퇴`를 넣었습니다).
- **날짜는 시간표에 없어서 계산합니다.** 시간표에는 "화요일 2교시"만 있고 달력 날짜가 없는데 날짜 없는 보강원은 결재가 안 납니다. 사용자가 고른 **기준일이 속한 주(월요일 시작)**에서 요일에 맞춰 뽑고(`dateForWeekday()`), 항목마다 직접 고칠 수 있게 열어뒀습니다(다음 주로 미룬 교체 등). `new Date("2026-08-20")`은 UTC로 읽혀 하루가 밀리므로 `parseDate()`가 직접 조립합니다 — 이걸 `new Date(문자열)`로 되돌리지 마세요.
- **담기(트레이) 방식입니다.** 출장 한 번이면 하루 3~4시간이 비고 실무에선 그걸 한 장에 적으므로, 버튼이 문서를 바로 뽑지 않고 트레이에 한 줄씩 쌓습니다(`components/makeup/useMakeupTray.ts`). 한 결강 시간에는 한 사람만 들어가야 하므로 같은 (교사·요일·교시)는 중복으로 담기지 않고, 이미 담긴 시간의 후보들은 버튼 대신 "담김" 표시로 바뀝니다.
- **서버에 저장하지 않습니다.** 사용자가 1단계 범위를 "저장 없음"으로 정했습니다. 그래서 인쇄 페이지로는 브라우저 저장소(`MAKEUP_DOC_KEY`)로 넘깁니다 — 나중에 "내가 낸 보강원 목록/교무부장 전체 조회"를 열려면 그때 테이블을 추가하면 됩니다.
  - **⚠️ 이 전달에 `sessionStorage`를 쓰면 안 됩니다 (2026-08-21에 실제로 터진 버그).** sessionStorage는 탭마다 별개이고, 새 탭이 사본을 물려받는 건 opener 관계가 있을 때뿐인데 트레이가 `window.open(..., "noopener")`로 열기 때문에 그 관계가 끊깁니다. 그래서 인쇄 탭에는 항상 "보강원 데이터가 없습니다"만 떴습니다. 지금은 **트레이가 `localStorage`에 쓰고, 인쇄 페이지가 읽자마자 `localStorage`에서 지운 뒤 자기 탭의 `sessionStorage`로 옮깁니다** — 탭 간 전달은 확실해지고, 사유(병가 등)가 브라우저에 남지 않으면서, 인쇄 탭에서 새로고침도 됩니다.
  - **검증할 때 주의**: 인쇄 페이지를 주소창으로 직접 열면 같은 탭이라 sessionStorage가 살아 있어 **버그가 가려집니다**. 반드시 트레이의 "보강원 만들기" 버튼을 눌러 새 탭이 열리는 경로로 확인하세요(그게 이 버그를 놓친 이유입니다).
- **⚠️ 문서 모양은 `src/features/schedule-helper/components/makeup/MakeupSheet.tsx` 한 파일에만 있습니다** (2026-08-21에 인쇄 페이지에서 분리 — 인쇄 페이지는 이제 데이터를 받아 장 수만큼 늘어놓고 인쇄창을 여는 일만 합니다). 서식이 바뀌면 여기만 고치면 되고 담기·날짜 계산·데이터 전달은 손댈 필요가 없습니다. **한글 파일 자체를 채워 내보내는 건 불가능**하므로(AI 파트너가 hwp 업로드를 막아둔 것과 같은 이유) 같은 모양을 화면으로 재현해 인쇄·PDF로 뽑는 방식입니다.
  - **칸 너비는 눈대중이 아니라 원본 PDF에서 글자 좌표를 재서 맞춘 값입니다.** 본문 폭 472pt(=166mm) 기준으로 15.3 / 12.7 / 10.6 / 19.1 / 19.1 / 23.2%이고, 인쇄 시 이 폭이 나오도록 `@page { margin: 18mm 22mm }`(210−44=166mm)를 씁니다. 서식과 나란히 놓고 어긋나면 이 숫자부터 보세요. 좌표는 `unpdf`(이미 설치돼 있음)로 `page.getTextContent()`의 `transform[4]/[5]`를 찍어보면 다시 잴 수 있습니다.
  - 서식의 표는 **3줄로 인쇄**돼 있어 건수가 적으면 빈 줄로 채웁니다(`MIN_ROWS`). 3건이 넘으면 줄이 늘어납니다 — 한 장을 넘길지는 결재 관행을 몰라 그대로 두었으니, 넘치는 사례가 나오면 그때 정하세요.
- **인쇄 페이지는 로그인 게이트 안(`/apps/schedule-helper/*`)이라 로컬에서 눈으로 확인하기 어렵습니다.** 로컬 `DATABASE_URL`이 더미면 로그인 자체가 안 되기 때문입니다. 모양을 확인해야 할 때는 `MakeupSheet`를 임시 페이지(예: `src/app/makeup-preview/page.tsx`, 게이트 밖)에서 fixture로 렌더해 보고 **확인 후 지우세요**(2026-08-21에 그렇게 검증했습니다). 참고로 `src/app/_이름/` 처럼 밑줄로 시작하는 폴더는 Next.js가 라우팅에서 제외하므로 404가 납니다.
- **연쇄 교체(2단계)에는 버튼이 없습니다** — 세 사람이 얽혀 문서가 4줄이 되고 신청인도 애매해서 의도적으로 제외했습니다. 직접 교체·동과 대강 후보에만 붙습니다. 동과 대강은 상대의 수업을 내가 대신 갈 시간이 없어 교체가 성립하지 않으므로 **[보강]만** 노출합니다.
- **`/api/schedule` 응답에 `schoolName`을 추가했습니다**(문서 머리·"○○학교장 귀하"용). `src/config/hub.ts`에도 학교명이 있지만 그건 이 학교 전용 하드코딩이라 멀티테넌트에서 쓰면 안 됩니다 — `School.name`을 써야 합니다.
- **인쇄 페이지는 열리자마자 `window.print()`를 부릅니다.** 브라우저 자동화로 이 페이지를 열면 인쇄 대화상자가 렌더러를 막아 `get_page_text`/`computer`가 타임아웃합니다(실제로 겪음). 내용을 확인해야 하면 그 타이머를 잠깐 끄고 보세요.

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

### 2026-08-21

**보강원을 학교 실제 서식("수업 교체 및 동과 보강 계획서")대로 다시 만듦:**
- 8/13에 "서식을 받으면 그 모양으로 교체"로 남겨둔 숙제를, 사용자가 PDF 서식을 주면서 마무리했습니다.
- **설계 하나가 실제로 틀렸던 것을 서식이 알려줬습니다.** 초기엔 "교체는 두 줄로 펼쳐야 결재가 난다"고 판단해 `rowsForEntry()`가 교체 1건을 2줄로 만들었는데, 실제 서식에는 `수업 교체의 경우만 기재 → 교체대상 교시/교과` 열이 있어 **한 줄 안에서** 맞바꿈이 표현됩니다. 두 줄로 적으면 교체대상 칸이 비고 같은 건이 중복돼 보입니다. `rowForEntry()`(단수)로 바꾸고 위 참고 메모에 정정 이유를 남겼습니다 — **서식 없이 세운 가정은 서식이 오면 반드시 다시 검증해야 한다**는 사례입니다.
- **"하루에 한 장씩" 요구를 반영**했습니다(서식 하단 작성 요령). `buildSheets()`가 트레이를 결강일별로 갈라 `MakeupDoc.sheets`로 만들고 인쇄 시 장마다 페이지를 끊습니다. 트레이 자체는 여러 날을 담을 수 있게 두고 뽑을 때 자동으로 갈립니다(트레이에 "N장으로 나옵니다" 안내).
- **`사 유`를 서식의 보기 그대로**(출장·연가·병가·조퇴·특별휴가·기타)로 맞췄습니다. 기존 목록의 `공가`는 서식에 없어 빼고 `조퇴`를 넣었습니다. 고른 항목엔 동그라미(테두리)를 쳐서 인쇄합니다.
- **모양 파일을 `MakeupSheet.tsx`로 분리**했습니다. 인쇄 페이지가 로그인 게이트 안이라 로컬에서 열어볼 수 없어, 게이트 밖 임시 페이지에 fixture로 렌더해 검증하려면 분리가 필요했습니다(검증 후 임시 페이지 삭제).
- **칸 너비를 원본 PDF 좌표로 실측해 맞췄습니다.** `unpdf`로 글자 `transform` 좌표를 찍어 열 경계를 역산하고(본문 472pt), 인쇄 폭이 166mm가 되도록 `@page` 여백을 22mm로 잡았습니다. 브라우저에서 표 폭 166.0mm를 확인했습니다.
- **검증:** fixture(교체 2건·보강 1건, 결강일 화/목 2일)로 렌더 → 장이 2장으로 갈리고 `일 시`가 화 8/11·목 8/13, 교체 줄의 교체대상이 수 8/12·금 8/14로 정확히 계산됨, 보강 줄은 교체대상 칸이 빔, 머리글 rowspan/colspan이 서식과 동일, 사유는 "출장"에만 동그라미, 빈 줄로 3줄 유지까지 확인. `npx tsc --noEmit`·eslint(makeup 경로) 클린, `npm run build` 42페이지 정상.
- **인쇄 탭에 데이터가 안 넘어가던 버그도 같이 고쳤습니다.** 사용자가 직접 눌러보고 "보강원 데이터가 없습니다"가 뜬다고 알려줘서 발견했습니다 — `sessionStorage` + `noopener` 조합 문제이고, 원인과 대책은 위 참고 메모에 적었습니다. **제 검증이 이걸 놓친 이유는 인쇄 페이지를 같은 탭에서 주소로 직접 열어봤기 때문**입니다(같은 탭이면 sessionStorage가 살아 있어 정상으로 보임). 앞으로 이 화면은 반드시 버튼을 눌러 새 탭이 열리는 경로로 확인하세요.
- **남은 것**: 표가 3줄을 넘칠 때 장을 넘길지는 결재 관행을 몰라 정하지 않았습니다(지금은 줄이 늘어납니다).

### 2026-08-13

**수업교체 도우미에 보강원 자동 작성 추가:**
- 사용자 요청: "후보 중 원하는 사람 옆에 교체·보강 버튼을 붙여 고른 뒤, 내가 주는 서식의 보강원으로 바로 문서를 만들어달라". 계획 단계에서 세 가지를 정했습니다 — **서식 파일은 나중에**(한글 서식이 있으나 그 자리에 없었음), **서버 저장은 안 함**, **담기 방식으로 한 장에 여러 건**.
- 설계·구현 내용은 위 "📝 보강원 작성(makeup) 참고 메모" 섹션에 정리했습니다. 특히 **요일→날짜 계산**은 다음에 손댈 때 반드시 먼저 읽으세요. (※ 이때 정한 "교체는 두 줄" 규칙은 2026-08-21에 실제 서식을 받고 **한 줄로 정정**됐습니다 — 위 8/21 항목 참고.)
- **계획 단계에서 먼저 짚은 두 가지 구멍** — 둘 다 사용자가 요청에 적지 않았지만 없으면 서류가 반려되는 것들입니다. (1) 시간표에 달력 날짜가 없어 "화요일 2교시"만으로는 결재가 안 남 → 기준일 입력 + 주간 계산. (2) 실무에선 출장 한 번에 하루 3~4시간이 비고 그걸 한 장에 적음 → 1건 1장이 아니라 담기 방식. 요구사항을 그대로만 구현했으면 둘 다 놓쳤을 부분입니다.
- **검증:** 디스포저블 학교(김결강/박교체/이보강, 시간표는 `School.scheduleData`에 직접 주입)로 교체 1건 + 보강 1건을 담아 문서를 생성 → 3줄(교체가 2줄로 펼쳐지고 두 번째 줄 방향이 뒤집힌 것), 날짜 자동 계산(기준일 8/13 목 → 화 8/11, 수 8/12), 날짜순 정렬, 인쇄 페이지 렌더링까지 확인. `npx tsc --noEmit` 클린, 신규·수정 파일 eslint 클린. 테스트 학교는 삭제했고 실제 데이터(명신고, 계정 5, 챗봇 1·조각 55) 무영향 확인.
- **주의로 알게 된 것**: `School`을 지워도 그 학교 소속 `User`는 남습니다 — `User.schoolId`가 `@relation` 없는 평범한 문자열이라 cascade가 걸리지 않기 때문입니다(better-auth 모델을 CLI가 재생성해도 안전하도록 의도한 설계). 디스포저블 학교를 정리할 땐 **`user` 테이블의 고아 행도 같이 지워야** 합니다(`SELECT ... FROM "user" WHERE "schoolId" NOT IN (SELECT id FROM "School")`로 찾을 수 있습니다). 실제로 예전 세션들이 남긴 고아 계정 3개를 이번에 발견했고, 이번 작업과 무관하고 삭제는 되돌릴 수 없어 사용자에게 확인을 요청한 상태로 남겨뒀습니다.
- **남은 일**: 사용자가 학교 한글 보강원 서식을 주면 인쇄 페이지의 표·머리말을 그 모양으로 교체. 현재 표는 임시 형태입니다.

### 2026-08-10 (2)

**저장소 정리 — 죽은 파일 제거, 온보딩 문서 최신화:**

exam-scheduler 통합 직후, 저장소에 오래 쌓여 있던 잔재를 걷어냈습니다. **삭제한 것은 전부 "어디서도 import/참조되지 않음"을 먼저 확인한 뒤 지웠고**(`Dockerfile`/`deploy.sh`/`docker-compose.yml`/`package.json` 스크립트까지 grep으로 확인), 정리 전후로 `npm run build`를 돌려 라우트 목록이 동일한지 대조했습니다. git 이력에는 그대로 남아 있으니 필요하면 언제든 복구할 수 있습니다.

- **삭제(약 800KB):**
  - `app.tar.gz`(433KB) — NAS 배포 시절 만든 **저장소 자신의 스냅샷 tarball**. 저장소 안에 저장소 사본이 통째로 들어있던 셈이라 가장 큰 파일이었습니다. 내용물을 열어 비밀정보가 없음을 확인한 뒤 삭제했습니다.
  - 루트 `page.tsx`(65KB, 1304줄) — 2026-07-19 리팩터링 **이전**의 통짜 페이지. GitHub 웹 UI에서 "Add files via upload"로 올라온 뒤 방치돼 있었고 어디서도 import되지 않습니다.
  - `extract_context.js` / `extract_hooks.js` / `replace.py` / `update.py` — 넷 다 **옛 `src/app/page.tsx`(통짜 파일)를 문자열 치환**하던 1회용 리팩터링 스크립트입니다. 지금의 `src/app/page.tsx`는 허브 화면(159줄)이라 이 스크립트들을 실행하면 무의미하거나 오작동합니다.
- **추적 해제(파일은 디스크에 남김):** `tsconfig.tsbuildinfo`(296KB), `next-env.d.ts` — 둘 다 빌드할 때 자동 생성되는 산출물이고 **create-next-app 기본 `.gitignore`에 원래 들어있는 항목**인데 빠져 있었습니다. 그래서 빌드할 때마다 무의미한 diff가 생기고 실제로 커밋에 딸려 들어가고 있었습니다. `.gitignore`에 `*.tsbuildinfo`/`next-env.d.ts`를 추가하고 `git rm --cached`로 추적만 끊었습니다.
- **`samples/` 폴더 신설:** 루트에 흩어져 있던 `sample.xlsx`~`sample7.xlsx`(7개, 233KB)를 `samples/`로 옮기고 설명 README를 붙였습니다. **지우지 않은 이유**: 화면 안내 문구에 `학생 선택 데이터 파일 (sample3) 업로드`처럼 파일 이름이 그대로 박혀 있어, 개발 중 손으로 올려 검증하는 실제 표본입니다. **`public/sample-roster-*.xlsx`와 혼동하지 마세요** — 그쪽은 코드가 `fetch('/sample-roster-1.xlsx')`로 URL을 직접 읽으므로 반드시 `public/`에 있어야 하고, `samples/`로 옮기면 즉시 깨집니다.
- **`.env.example`이 SQLite로 남아 있던 문제 수정 (중요):** 2026-07-21에 Postgres로 이전했는데 예시 파일만 `DATABASE_URL="file:./dev.db"`(SQLite) 그대로였습니다. **새 컴퓨터에서 이 파일을 복사해 시작하면 즉시 실패하는 상태**였습니다. postgresql 형식으로 고치고, 랜 내부/외부 주소가 왜 다른지, 그리고 "허브·수강신청·시험 시간표 도우미만 볼 거면 접속 안 되는 더미 값이어도 `next dev`가 뜬다(단 값이 아예 없으면 부팅 실패)"는 점을 주석으로 적어 두었습니다.
- **`README.md`** — create-next-app 보일러플레이트를 지우고 부서·앱 목록 표, 셋업 순서, 폴더 구조, `.agents/AGENTS.md`로 가는 안내로 교체했습니다.
- **검증:** 정리 전/후 `npm run build` 라우트 목록 동일, `npx tsc --noEmit` 클린, 브라우저에서 허브 → 수강신청 도우미 → 시험 시간표 도우미 5단계 전체(표본 명단 78명 로드, 국어 29명 분반 대상·수학 7명 합반 추천 판정, 시간표 과목 필터, 분반 대화상자) → 쌤스 헬퍼 로그인 리다이렉트(`?next=` 포함)까지 확인했습니다.

**`xlsx`를 CDN 풀빌드로 바꾼 것이 안전한지 실측 확인:** exam-scheduler 통합 때 `xlsx`를 npm 무료판 `^0.18.5` → SheetJS CDN `0.20.3`으로 올렸는데, 허브가 원래 쓰던 3곳(`extractText.ts`/`parseAccountsWorkbook.ts`/`sheetData.ts`)이 실제로 호출하는 API는 `XLSX.read`/`utils.sheet_to_csv`/`utils.sheet_to_json` 셋뿐이고 전부 **읽기 전용**임을 확인했습니다(쓰기는 전부 `xlsx-js-style`·`exceljs`가 따로 담당 — 그쪽은 손대지 않았습니다). 0.20.3에서 이 셋이 모두 존재하는 것과, 봉투 표지가 요구하는 BIFF8(`.xls`) 쓰기→읽기 왕복이 한글 문자열까지 정상인 것을 node로 직접 돌려 확인했습니다.

**아직 정리하지 않은 것 (일부러 남겨둔 것들 — 다음에 손댈 사람 참고):**
- `src/components/tabs/*.tsx`(enrollment-helper의 3개 탭 컨테이너)와 `src/components/ui/SearchableSelect.tsx`는 다른 앱들이 `src/features/<이름>/` 아래에 모여 있는 것과 달리 혼자 `features/` 밖에 있습니다. 옮기면 import 경로가 여러 파일에서 연쇄로 바뀌는데 **동작상 이득이 전혀 없어** 이번엔 두었습니다.
- `AppSwitcher`는 허브 전역 개념(`src/config/hub.ts`를 읽음)인데 `src/features/schedule-helper/components/`에 있습니다. 같은 이유로 두었습니다.
- `Dockerfile`/`docker-compose.yml`/`deploy.sh` — NAS 앱 배포는 2026-07-21부로 중단 상태지만 나중에 다시 쓸 수 있다고 기록돼 있어 **삭제하지 않았습니다**.
- `.agents/AGENTS.md`가 163KB(약 5만 토큰)라 매 세션 컨텍스트를 크게 차지합니다. 히스토리 로그를 별도 파일로 빼는 안을 검토했지만, 잘못 자르면 맥락이 유실되어 이번엔 손대지 않기로 했습니다.

### 2026-08-10

**"교육평가부" 부서 신설 및 별도 프로젝트 앱(exam-scheduler) 통합:**
- 사용자가 메인 허브 화면의 "큰 목록"(왼쪽 부서 pill)에 교육과정부 바로 아래로 "교육평가부" 부서를 추가하고, "작은 목록"(오른쪽 앱 카드)에 "시험 시간표 작성 도우미"를 연결해달라고 요청했습니다.
- 이 도구는 사용자가 이 저장소와는 별도로 로컬에서 개발해 온 Next.js 프로젝트(`Documents/dev/exam-scheduler`, 구 Python/Eel 데스크톱 앱을 이식하던 중이던 프로젝트, GitHub 원격 없음)로 이미 완성되어 있었습니다. 처음엔 사용자가 말한 "메인 화면"의 정체(어느 저장소인지)가 로컬 어디에도 없어 GitHub의 `Ryuminje` 계정 공개 저장소 목록을 뒤져 `subject-selector`(바로 이 저장소)가 맞다는 걸 확인하는 과정이 있었습니다 — 앞으로 비슷하게 "저장소를 못 찾겠다"는 상황이 오면 이 방식(GitHub 계정의 공개 저장소 목록 조회)을 참고하세요.
- 스택 호환성(Next 16 / React 19 완전 동일, Tailwind v4 동일)을 먼저 확인한 뒤 schedule-helper 때와 같은 패턴으로 소스를 이 저장소 안으로 포팅해 `/apps/exam-scheduler`로 합쳤습니다. 자세한 포팅 방식(파일 매핑, 의존성 교체 이유, CSS 병합, 원본과의 수동 동기화 방식)은 위 "🎓 별도 앱 통합(exam-scheduler) 참고 메모" 섹션에 정리했습니다.
- `src/config/hub.ts`에 `HubDepartment` 두 번째 항목(교육과정부와 쌤스 헬퍼 사이)으로 "교육평가부" 부서를 추가했고, 왼쪽 pill 색상 순환(`palette` 배열) 세 번째 색(emerald)이 자동으로 적용됩니다.
- 브라우저에서 허브 → 교육평가부 카드 → 시험 시간표 작성 도우미 진입, 5단계 마법사 전체 클릭 이동, 표본 명단 로드까지 수동 검증했습니다. tsc/eslint(새 파일 기준) 클린, 기존 다른 부서 앱 회귀 없음 확인.

### 2026-08-06

**"업무 AI 파트너"(assistant) 신규 앱 1단계 + Postgres를 pgvector로 전환:**
- 사용자가 카카오톡 형태의 참고 이미지를 주며 "쌤스 헬퍼 하위에, 아이디별로 자료를 올려 그 자료로 답하는 챗봇을, 한 계정이 여러 개 만들 수 있게" 요청했습니다. 색은 수강신청 자료 정리 도우미의 톤앤매너를 지정받았습니다. 계획 단계에서 **클릭 가능한 HTML 목업 3화면(목록/대화/설정)** 을 먼저 보여주고 승인받은 뒤 구현했습니다(이수증 재설계 때와 같은 방식 — 글로만 설명하지 말고 화면을 보여주는 게 훨씬 빨랐습니다).
- 사용자가 고른 결정 두 가지: 검색은 **pgvector 설치**(설치 없이 JS 계산하는 대안 대비 장기적으로 맞음), 1단계 범위는 **"나만 쓰는 챗봇"까지**(학교 공개는 2단계).
- 인프라: NAS Postgres를 `postgres:16-alpine` → `pgvector/pgvector:pg16`으로 교체. **musl↔glibc 로케일 차이 때문에 데이터 디렉터리를 물려주지 않고 덤프→복원으로 진행**했습니다(위 "pgvector 전환" 항목에 이유와 절차 정리). 이 세션에서는 SSH 쓰기 작업이 안전 분류기에 막혀 사용자가 직접 명령을 실행했고, 복원 출력을 `tail`로 자르는 바람에 에러가 가려져 한 번 "복원 실패"로 오판했다가 재확인으로 정정했습니다(행 수 13개 테이블 전부 원본과 일치, FK 9개·인덱스 31개·마이그레이션 이력 보존 확인).
- 구현: 스키마 5개 모델 + 마이그레이션, `lib/assistant/` 6개 파일(config·extractText·chunk·embed·search·chat·access), API 라우트 7개, UI 컴포넌트 8개, 허브 카드 등록. 의존성 `unpdf`(PDF 텍스트, 쪽수 보존)·`mammoth`(DOCX) 추가.
- **UI를 짓기 전에 가장 불확실한 부분(임베딩 API 형식, 검색, 답변)을 먼저 실물로 검증한 것이 크게 도움이 됐습니다.** 그 과정에서 위 참고 메모에 적은 두 버그(SSE CRLF 구분자, 임베딩 유사도 기준선)를 잡았습니다 — 특히 CRLF 문제는 UI까지 다 만든 뒤였다면 원인 찾기가 훨씬 어려웠을 것입니다.
- **같은 날 후속 수정(앱 이동 드롭다운)**: 앱이 3개가 되면서 헤더의 "○○로 이동" 링크가 늘어나는 문제를 사용자가 지적해, 현재 앱 이름 버튼에 호버하면 같은 부서 앱이 펼쳐지는 `AppSwitcher`로 교체했습니다. 세 화면(시간표 교체 도우미·연수 이수증 수거·업무 AI 파트너)에 모두 적용. **목록은 `src/config/hub.ts`가 단일 소스**라 앞으로 앱을 추가할 때 헤더는 건드릴 필요가 없습니다 — 자세한 내용은 위 "허브 라우팅 구조" 섹션의 `AppSwitcher` 항목 참고.
- **같은 날 후속 수정(속도 제한 대응)**: 사용자가 실제 PDF 4개를 연달아 올리자 마지막 파일이 Gemini 429로 실패하고 영어 원문 오류가 화면에 그대로 노출됐습니다. 429 백오프 재시도 + `failed` 대신 대기 후 재개 + "다시 분석" 버튼 + 오류 한국어화(`geminiError.ts`)를 추가했습니다. 자세한 규칙은 위 참고 메모 참고. 검증은 **일부러 잘못된 API 키를 등록해 실패시킨 뒤 키를 고치고 "다시 분석"으로 완전히 복구되는지**까지 확인했습니다(실패 메시지 한국어 확인, 재시도 없이는 failed 유지되는 것도 확인).
- 검증: 일회용 테스트 학교에 **세상에 없는 가짜 규정**("교외체험학습 연간 17일, 3학년 9일")을 올려 그대로 답하는지 확인 → 정확히 답함(모델의 사전 지식이 아니라 자료를 읽었다는 증거). 자료에 없는 질문("급식비")에는 "확인할 수 없습니다"라고 답하고 근거 칩이 빈 배열로 내려오는 것까지 확인. 브라우저에서 로그인→목록→대화(스트리밍·근거 칩)→설정(자료함 상태)까지 콘솔 에러 없이 동작 확인 후 테스트 학교 4개 전부 삭제(실제 학교 데이터 무영향, 계정 수 원복 확인). `tsc --noEmit`/`eslint` 클린.

### 2026-08-05 (4)
**연수 교직원 등록부 인쇄 시 서명이 안 나오는 버그 수정 — 서명을 data URI로 함께 내려보내도록 변경:**
- "인쇄 화면에는 서명이 분명히 보이는데 실제로 인쇄(PDF 저장)하면 서명 칸이 비어 있다"는 제보. 화면과 인쇄 결과가 다른 전형적인 케이스였고, 원인은 **서명 이미지를 별도 HTTP 요청으로 불러온 것** 두 가지 방식으로 겹쳐 있었습니다.
  1. **캐시 재검증 문제(주원인)**: `GET /certificates/signatures/[id]/image`가 `Cache-Control: private, no-cache`로 응답했습니다. 브라우저가 인쇄 미리보기를 만들 때 문서를 다시 렌더링하는데, `no-cache` 이미지는 재사용 전에 서버 재검증(재요청)을 거쳐야 합니다. 이 재요청이 인쇄 렌더링 시점에 이뤄지지 못하면 그 칸이 빈 채로 출력됩니다. **서명이 1개뿐이어도 발생**하는 이유가 이것입니다.
  2. **고정 타이머 경쟁(악화 요인)**: 인쇄 페이지가 JSON 응답 후 **무조건 400ms 뒤에 `window.print()`**를 호출했습니다. 이미지 로딩 완료를 전혀 기다리지 않아, 서명이 많거나 원격 환경이면 아직 안 그려진 서명이 그대로 빠집니다(로컬 1×1 PNG 12장 기준 168ms라 로컬에서는 재현되지 않음 — 실제 55명·실제 서명 PNG·원격 서버에서 초과).
- **해결**: `sessions/[id]/print` 라우트가 `signatureId` 대신 **`signature`(base64 data URI)**를 함께 내려보내도록 바꿔서 **인쇄 시 다시 가져올 요청 자체를 없앴습니다**. 이 라우트는 이미 관리자 전용 인증이 걸려 있어 권한 수준은 동일합니다. 부수적으로 `window.print()` 호출도 고정 타이머 대신 **모든 `<img>`의 load/error를 기다린 뒤**(5초 상한) 실행하도록 바꿨습니다.
- **함께 고친 인쇄 문제**: 표 머리글이 `bg-[#1a237e] text-white`인데 **브라우저는 기본적으로 배경색을 인쇄하지 않아** 인쇄물에서 흰 바탕에 흰 글씨가 되어 "번호/성명/서명"이 보이지 않았습니다. `@media print`에 `print-color-adjust: exact`를 넣어 머리글 배경을 유지하고, `tr { break-inside: avoid }`로 행이 페이지 경계에서 잘리지 않게 했습니다.
- **정리**: 이 변경으로 `GET /certificates/signatures/[id]/image` 라우트가 아무 데서도 쓰이지 않게 되어 삭제했습니다(화면의 QR 이미지는 다른 경로라 무관). grep으로 잔여 참조가 주석 하나뿐임을 확인했습니다.
- 디스포저블 테스트 학교(20명 명단·12명 서명)로 검증: 인쇄 API가 `data:image/png;base64,...`를 반환하는지, 그 data URI가 실제로 이미지로 디코딩되는지, **인쇄 페이지 로드 후 `signatures/*/image` 요청이 하나도 발생하지 않는지**를 네트워크 로그로 확인. 검증 후 테스트 학교 삭제. `tsc --noEmit`/`eslint` 클린.
- **인쇄 페이지를 자동화 도구로 열면 `window.print()`가 네이티브 대화상자를 띄워 렌더러가 멈춥니다** — 이후 `javascript_tool`이 타임아웃되므로, 검증할 땐 인쇄 페이지를 직접 열지 말고 API 응답과 네트워크 로그로 확인하거나 새 탭을 만들어 빠져나오세요.

### 2026-08-05 (3)
**연수 이수증 수거 화면 전면 재설계 — 탭 5개 → 3개, "연수 카드 = 진행률" 단위로 재구성:**
- 사용자가 "지금 시스템은 알아보기 어렵다. 이수증 수거는 누가 제출했는지 확인하는 방식이어야 하고, 서명은 서명이 필요한 경우인데 구분이 안 된다"고 지적하며 개선안을 **글이 아니라 화면으로** 보여달라고 요청. 먼저 클릭 가능한 HTML 목업(Artifact)으로 방향을 합의한 뒤 구현했습니다.
- **진단**: 기존 5탭(연수목록 관리/제출하기/내역조회/일괄확인/서명받기)은 "작업 종류"별 분할이라, 연수 하나를 관리하려면 탭 3곳을 오가야 했습니다(등록은 연수목록 관리, 누가 냈나는 일괄확인, 무엇을 냈나는 내역조회). 서명 현황은 아예 별도 세션 상세 페이지에만 있었습니다.
- **핵심 통찰**: 이수증과 서명은 결국 같은 질문("이 연수, 누가 완료했고 누가 안 했나")이고 **수집 방법만 다릅니다**(파일 업로드+AI 추출 vs 현장 QR 서명). 그래서 두 카테고리를 같은 카드·진행률 언어로 통일하고, 수집 도구만 카드 상세 안에서 갈라지게 했습니다.
- **신규 API `GET /certificates/overview`**: 등록된 모든 연수를 `대상 명단/완료/미완료/내 상태` 한 모양으로 반환. 이수증은 `TrainingCertificate` 제출로, 서명은 **그 제목을 포함하는 가장 최근 SignSession**의 서명으로 완료를 판정하고, 세션이 없으면 연수 전용 명단→전체 기본 명단으로 폴백합니다. 기존 bulk-check의 권한 경계를 그대로 유지해 **이름 목록(done/missing)은 관리자 또는 등록 담당자에게만** 내려보내고, 그 외에는 인원수와 "내 상태"만 내려보냅니다(교사가 자기가 뭘 안 냈는지 알 수 있게 하려면 카운트는 필요하고, 개인 식별 정보인 이름은 기존과 동일하게 가림).
- **신규 컴포넌트**: `TrainingProgressCard`(공용 카드), `CertificateBoard`/`CertificateDetail`, `SignBoard`/`SignDetail`, `TrainingEditorPanel`(연수+명단 등록/편집), `CommonSettings`(공통 설정), `useCertificateOverview`.
- **삭제**: `TrainingListManager`, `TrainingTitleManager`, `BulkCheckTab`, `useBulkCheck` (기능은 전부 카드/상세로 흡수). `SubmitTab`/`HistoryTab`/`SignTab`은 보드 안의 하위 화면으로 **재사용**해서 기능 손실이 없게 했습니다 — 특히 "복수 연수 QR 세션"은 카드 모델로 표현이 안 되는 기능이라 `SignTab`을 그대로 별도 화면으로 남겼습니다.
- **교사 경험이 가장 크게 바뀜**: 카드에 `내가 미제출` + `지금 제출` 버튼이 직접 붙고, 그 버튼이 연수 제목이 미리 채워진 제출 화면으로 바로 넘어갑니다(`useSubmitCertificate`에 `initialTitle`/`onSubmitted` 옵션 추가). 예전에는 제출하기 탭에서 연수를 직접 골라야 했고 자기가 뭘 안 냈는지 알 방법이 없었습니다.
- **명단 프리셋은 공통 설정 탭 한 곳으로** (사용자 요청). 원래도 API에 카테고리 구분이 없어 공통이었지만 "연수목록 관리"의 3번째 서브탭에 묻혀 있어 공통인 게 드러나지 않았습니다. 이제 안내 문구로 명시하고, 연수 등록/편집 패널에서 프리셋 칩으로 바로 불러 쓸 수 있습니다. `GeminiKeySettings`/`ExtraRosterSettings`도 여기로 모았습니다(`SubmitTab`에서 Gemini 키 섹션 제거).
- **주의해서 지킨 것**: 서명 연수의 "새 연수 등록"은 원래 교사 누구나 가능했으므로(training-titles POST가 로그인 전원 허용) 처음에 관리자 전용으로 만들었다가 되돌렸습니다. QR 세션 생성만 서버와 동일하게 관리자 전용으로 남겼습니다. 없어진 탭을 가리키던 안내 문구 4곳(`SubmitTab`, `TrainingTitleSelect`, `TrainingTitleMultiSelect`, `SignTab`, `RosterPresetManager`)도 새 구조에 맞게 수정했습니다.
- **린트 주의**: 이 프로젝트의 `react-hooks/set-state-in-effect` 규칙 때문에 **이펙트 본문에서 setState 직접 호출 금지**입니다. `CertificateDetail`은 부모가 `key={item.id}`로 렌더해 연수 전환 시 자연스럽게 리마운트되도록 해서 수동 초기화를 없앴고, `TrainingEditorPanel`은 동기 경로도 `Promise.resolve(...)`로 감싸 모든 setState가 `.then()/.finally()` 안에서만 일어나게 했습니다.
- 디스포저블 테스트 학교로 종단 검증: 전용 명단 연수(5명)와 전체 기본 명단 연수(10명)의 진행률이 각각 맞는지, 세션 있는 서명 연수(6/10)와 세션 없는 서명 연수(0/10 폴백)가 맞는지, 제출자 이름 클릭 시 이수번호/기관/날짜/파일이 뜨는지, "지금 제출"이 제목을 프리필하는지, **비관리자·비담당 교사에게는 이름 목록이 `HIDDEN`(null)으로 내려가고 화면에도 안내 문구만 뜨는지**까지 API 응답과 실제 화면 양쪽으로 확인. 검증 후 테스트 학교 삭제. `tsc --noEmit`/`eslint` 클린.
- **후속 정리 — `GET /certificates/bulk-check` 라우트 삭제**: 재설계로 이 라우트를 호출하는 코드가 전부 사라졌습니다(`BulkCheckTab`/`useBulkCheck`와 함께 제거됨). 로그인·권한 검사가 붙어 있어 보안 문제는 없었지만, **"연수 전용 명단 → 없으면 전체 기본 명단"이라는 명단 결정 규칙이 `bulk-check`와 `overview` 두 곳에 중복**돼 있어서(실제로 지난 "연수별 전용 명단" 작업 때 `bulk-check`를 따로 찾아가 고쳐야 했음) 나중에 규칙을 바꿀 때 한쪽만 고치고 지나칠 위험이 있어 삭제했습니다. 이제 그 판정 로직은 `overview/route.ts` 한 곳에만 있습니다. 삭제 후 `grep`으로 잔여 참조가 주석 하나뿐임을 확인하고 그 주석도 없어진 파일을 가리키지 않도록 고쳤으며, 실제 요청으로 해당 경로가 더 이상 데이터를 반환하지 않는 것(405, 빈 본문)과 `overview`가 정상(200)인 것까지 확인했습니다.

### 2026-08-05 (2)
**본조사 탭 4단계에 "사회/과학 과목 이수 필요" 표시 이식:**
- "선택과목 변경 탭 7단계엔 사회/과학 이수 학점이 0이면 비고란에 표시하는 기능이 있던데, 본조사 탭 4단계에도 똑같이 넣어달라"는 요청. 원본(`useStep6Data.ts`)은 `socialCount`/`scienceCount === 0`이면 `missingCategories`에 담아 보라색(`text-violet-700`) "OO 과목 이수 필요"로 표시하는 단순한 로직이라, 본조사 쪽(`useMainUploads.ts`)의 동일한 카운트 계산 직후에 그대로 이식.
- 공유 타입 `ProcessedStudent`(`src/types/index.ts`)에 `missingCategories?: ("사회"|"과학")[]`를 옵셔널로 추가 — 같은 타입을 쓰는 수요조사(`useDemandUploads.ts`)는 이 필드를 채우지 않으므로 옵셔널로 둬야 `tsc`가 깨지지 않음(실제로 처음엔 필수로 뒀다가 `useDemandUploads.ts`에서 타입 에러가 나서 옵셔널로 정정). 화면(`PreviewStep.tsx`)과 엑셀 다운로드 비고 열(`useMainClassSummary.ts`) 양쪽에 동일하게 반영해 화면·파일이 어긋나지 않게 함.
- 합성 데이터(사회+과학 모두 신청한 학생 / 국어만 신청해 둘 다 0인 학생)로 4단계 화면을 직접 렌더링해, 후자에만 "사회 과목 이수 필요"/"과학 과목 이수 필요"가 정확히 뜨는 것을 확인. `tsc --noEmit`/`eslint`는 변경 파일 기존 베이스라인과 동일(신규 이슈 0개).

### 2026-08-05 (1)
**5단계 "확정" 되돌리기를 1단계 스냅샷 → 스택으로 전환(다단계 확정 취소):**
- "확정하고 새로 추가하고 확정하고 또 추가해도, 확정 취소를 누르면 계속 그 이전 상태로 돌아가고 싶다"는 요청. 기존 `preConfirmSnapshot`은 학년별로 스냅샷 1개만 저장하는 구조라 확정을 두 번 이상 하면 가장 최근 확정 1건만 되돌릴 수 있었습니다.
- `useElectiveChanges.ts`의 `preConfirmSnapshot`(단일 객체)을 `confirmHistory`(스냅샷 배열, 스택)로 교체 — `handleConfirm`은 확정 직전 상태를 배열 끝에 push, `handleUndoConfirm`은 배열 끝에서 pop해 그 스냅샷으로 복원. 확정 이후 새 신청이 남아있으면 되돌리기를 거부하는 기존 안전장치(`hasNewPending`)는 그대로 유지. `canUndoConfirm`은 `confirmHistory[grade].length > 0`으로 판단하도록 변경했지만 boolean 타입 자체는 그대로라 `ApplicationStep.tsx` 등 소비 측 코드는 무변경.
- 백업 저장/불러오기(`ChangeSurveyTab.tsx`)도 `confirmHistory`로 저장하고, **옛 백업 호환**을 위해 `loadChangeBackup`에서 `parsed.confirmHistory`가 없고 `parsed.preConfirmSnapshot`(옛 단일 스냅샷 형식)만 있으면 1개짜리 배열로 자동 변환하도록 마이그레이션 처리.
- 합성 데이터로 확정→확정 취소만 남기고 새 신청 추가→확정(2건째)→확정 취소(1건째만 되돌아가는지, 되돌아간 자리에 새 신청이 되돌아오는지)→그 신청 삭제→확정 취소(0건째, 즉 최초 미확정 상태까지 완전히 되돌아가는지)까지 브라우저에서 전부 클릭으로 재현해 확인. 옛 형식 백업(`preConfirmSnapshot`만 있고 `confirmHistory` 없음)을 `loadChangeBackup`에 직접 넣어 1개짜리 스택으로 정상 변환되는 것도 확인. `tsc --noEmit`/`eslint`는 관련 파일 기존 베이스라인과 동일.

### 2026-08-02 (4)
**확정 관련 백업 저장/불러오기 후속 버그 2건 수정:**
- **"확정 취소"가 저장→불러오기 후 사라지는 문제**: `preConfirmSnapshot`(확정 취소에 필요한 "확정 직전 상태")이 훅 내부 state로만 있고 `useElectiveChanges.ts`의 반환값에 없어서, `getChangeBackup`/`loadChangeBackup`(`ChangeSurveyTab.tsx`)이 저장/복원할 방법이 아예 없었습니다. `confirmedLog`/`confirmedBaseSchedules`와 동일하게 `preConfirmSnapshot, setPreConfirmSnapshot`을 훅에서 반환하도록 추가하고, 백업 저장/불러오기 양쪽에 필드를 추가. 저장→새로고침(브라우저 재탐색으로 시뮬레이션)→불러오기 후에도 "확정 취소"가 정확히 확정 직전 상태로 복원되는 것까지 확인.
- **확정 전 파일을 불러와도 "확정됨" 상태가 유령처럼 남는 문제**: `loadChangeBackup`의 모든 필드가 `if (parsed.필드명) set필드명(...)` 패턴이라, 불러온 파일에 그 필드가 없으면(예: 확정 기능이 생기기 전에 저장된 옛 백업) 아무것도 안 하고 지나가서 **직전까지 메모리에 있던 값이 그대로 남습니다.** 사용자가 "확정 후 저장한 파일 (2)" 다음에 "확정 전 파일 (1)"을 불러오자, 신청 입력 표는 (1)의 내용으로 정상 갱신됐지만 `confirmedLog`/`confirmedBaseSchedules`/`preConfirmSnapshot` 세 필드가 (1)에 없어 직전 확정 상태(44명 확정됨)가 그대로 남아 뒤섞여 보이는 버그로 나타났습니다. 이 세 필드만 `parsed.xxx ?? {빈 기본값}` 형태로 바꿔 **파일에 없으면 항상 "확정 없음"으로 명시적으로 초기화**하도록 수정(다른 필드들은 이번 버그와 무관해 손대지 않음). 확정 상태를 메모리에 만든 뒤 확정 필드가 없는 옛 형식 백업을 다시 불러와, 유령 확정 상태 없이 파일 내용 그대로 깨끗하게 초기화되는 것을 확인.
- 두 수정 모두 `tsc --noEmit`/`eslint`가 관련 파일 기존 베이스라인과 완전히 동일(신규 이슈 0개).

### 2026-08-02 (3)
**5단계 "인원 균등화 최적화 알고리즘" 체크박스를 학년별로 완전히 분리:**
- 2학년 탭에서 체크박스를 켜면 3학년 계산에도 함께 적용되던 버그 제보. 원인은 `useElectiveChanges.ts`의 `enableOptimization`이 학년 구분 없는 단일 boolean이었기 때문 — `adjustmentLog`를 계산하는 memo는 `grade2`/`grade3`를 한 루프 안에서 함께 처리하는데, 이 안에서 sequential vs DFS(최적화) 알고리즘 분기를 그 단일 boolean으로 판단하고 있어서, 다른 학년 탭에서 켠 값이 지금 안 보고 있는 학년의 계산 방식까지 바꿔버리고 있었습니다.
- `enableOptimization`을 `Record<ChangeGradeKey, boolean>`으로 바꾸고, 자동배분 이펙트와 `adjustmentLog` memo의 두 분기 판단 모두 해당 학년 키로 조회하도록 수정. 체크박스 라벨에도 "(2학년만 적용)" 같은 현재 적용 범위 안내를 추가.
- 브라우저에서 2학년만 켠 뒤 3학년 탭으로 전환 시 체크박스가 꺼져 있는 것, 다시 2학년으로 돌아오면 켜져 있는 것까지 확인(React state 반영 타이밍 때문에 클릭 직후 즉시 읽으면 이전 값이 읽히므로, 검증 스크립트에 짧은 지연을 넣어야 함 — 실제 버그는 아니고 자동화 스크립트의 타이밍 문제였음). `tsc --noEmit`/`eslint` 클린.

### 2026-08-02 (2)
**5단계에 "확정"(체크포인트/freeze) 기능 추가 — 이미 자동배정 끝난 결과를 고정한 채 일부만 수동 수정:**
- 사용자가 처음엔 "변경 전/후 과목을 정확한 타임으로 고정하고 싶다"고 요청해 행 단위 "타임 고정"(`pinnedSlot`) 기능을 먼저 구현했으나(아래 (1) 항목), 실제로 원했던 시나리오는 달랐습니다: "자동 균등화 배정이 이미 끝난 상황에서 학생 한 명만 잘못된 걸 발견해 수동 수정하고 싶은데, 그 수정 때문에 이미 확정된 나머지 학생들의 배정까지 흔들리면 안 된다." 5단계 알고리즘은 화면에 있는 신청 전체를 매번 처음부터 재계산하는 구조라(인원 균등 분배 자동배분은 매번 2000회 반복 탐색을 새로 돌리고, 최적화 모드는 학생 간 공유되는 학급 인원수를 기준으로 비용을 계산), 신청 하나만 추가해도 다른 학생들의 결과가 조용히 같이 바뀔 수 있는 게 근본 문제였습니다.
- 해결책은 사용자가 스스로 제안한 "자동배정 후 확정 → 그 데이터를 저장해두고 새 수정사항만 반영"과 동일한 방향으로 구현: `useElectiveChanges.ts`에 `confirmedBaseSchedules`(학생별 확정된 최종 시간표)와 `confirmedLog`(확정 시점의 로그) 두 상태를 추가. "확정" 버튼(`ApplicationStep.tsx`)을 누르면 그 순간의 계산 결과를 이 두 상태에 흡수시키고 `electiveChanges`/`electiveChangesArbitrary`(입력 표)를 비웁니다. 이후 계산(`adjustmentLog` memo의 학생 스케줄 시작점, 자동배분 이펙트의 `lockedStudents`/`vSchedules` 초기값)은 전부 `confirmedBaseSchedules[학생] ?? 원본`을 기준으로 삼아, 확정된 학생은 자동배분에서 완전히 제외되고 새 신청은 확정된 최종 상태 위에서만 계산됩니다. 반환되는 `adjustmentLog`는 `confirmedLog + 새로 계산된 pending 로그`를 합친 값이라, 다운스트림(6/7/8단계, 엑셀 내보내기)은 코드 변경 없이도 확정분+새 변경분을 그대로 반영합니다(이 넷은 원래도 `parsedSampleData` 원본 + `adjustmentLog` 성공 항목을 조합해서 그리는 구조라, `adjustmentLog`에 확정분이 계속 들어있기만 하면 됨 — 실제로 코드를 읽어 이 패턴을 먼저 확인한 뒤 무변경으로 결론).
- **1단계 되돌리기**: `preConfirmSnapshot`에 확정 직전 상태를 저장해 "확정 취소" 버튼으로 가장 최근 확정 1건만 되돌릴 수 있게 했습니다. **검증 중 실제 데이터 유실 버그를 미리 발견**: 확정 후 새 신청을 추가한 상태에서 "확정 취소"를 누르면 되돌리기 로직이 `electiveChanges`를 스냅샷 값으로 덮어써서 방금 추가한 새 신청이 조용히 사라질 뻔했습니다 — `handleUndoConfirm`에 "새로 입력된 신청이 남아있으면 되돌리기를 거부"하는 안전장치를 추가하고, UI도 그 상태에선 버튼 대신 안내 문구를 보여주도록 했습니다.
- **검증 중 발견한 표시 버그 2건도 함께 수정**: (1) 결과 패널이 학생 목록을 입력 표(`electiveChanges`)에서 뽑고 있었는데, 확정 후 입력 표가 비워지면 확정된 결과가 화면에서 아예 사라지는 문제 — 학생 목록을 `adjustmentLog`(확정분 포함) 기준으로 뽑도록 바꾸고, 이름 조회도 `parsedSampleData`(전체 학년 명단)를 쓰도록 변경. (2) 그 수정의 부작용으로 `adjustmentLog`가 학년 구분 없이 학번으로만 저장된다는 사실이 드러나 2학년/3학년 결과가 서로 섞여 보이는 회귀가 생겼고, 결과 목록을 현재 학년 명단(`parsedSampleData[changeActiveGrade]`) 소속 학번으로만 필터링해서 고쳤습니다.
- 합성 데이터로 브라우저 종단 검증: 정상 확정(배지·입력 표 초기화 확인) → 확정된 학생 중 한 명에게만 새 신청 추가 → 그 학생은 확정+신규 변경이 함께 표시되고 **나머지 확정 학생은 로그가 한 글자도 안 바뀜** → 새 신청이 남은 상태에서 확정 취소가 막히는 것 → 새 신청 삭제 후 확정 취소가 정확히 이전 상태로 복원되는 것까지 전부 확인. `tsc --noEmit`/`eslint`는 이번 세션에서 건드린 파일 전체 기준으로 시작 시점 베이스라인과 완전히 동일(신규 이슈 0개).

### 2026-08-02 (1)
**5단계에 "타임 고정"(pinnedSlot) 기능 추가 — 변경 요청 하나의 목적지 타임을 사용자가 직접 지정:**
- 5단계 자동배정(`useElectiveChanges.ts`)은 기본 모드에서 변경후 과목이 개설된 타임 중 첫 번째로 2단계 교환이 성립하는 곳을, 최적화 모드에서는 학급 인원이 가장 안 몰리는 곳을 알고리즘이 알아서 골랐습니다. 내부적으로 "인원 균등 분배" 자동생성기가 쓰는 `_targetSlot`이라는 비슷한 매커니즘이 이미 있었는데(사용자에게 노출 안 됨), 이를 확장해 신청 행마다 `pinnedSlot`을 사용자가 직접 고를 수 있게 했습니다(`ElectiveChangeTable.tsx`에 "타임 고정" 드롭다운 신설, 옵션은 그 과목이 실제 개설된 타임만).
- 고정된 슬롯이 있으면 두 알고리즘 모두 후보 타임을 그 하나로만 제한하고(대체 탐색 없음, 실패 시 명확한 사유와 함께 실패 처리), 같은 학생의 다른 요청보다 먼저 적용되도록 정렬해서 "1순위 고정"을 보장합니다. 기존에 있던 "변경후 과목이 이미 그 타임에 있으면 그냥 덮어쓰는" 지름길 로직도, 고정된 타임이 원래 타임과 다르면 건너뛰도록 가드를 추가해 고정이 무시되지 않게 했습니다.
- **검증 중 UI 버그 발견 및 수정**: 고정한 타임이 (예: 과목 재입력 등으로) 더 이상 유효한 후보가 아니게 되면 `<select>`가 조용히 "자동"으로 보여 사용자가 알아채기 어려운 문제를 발견 — 그런 경우엔 빨간색으로 "B 타임 (개설 안 됨)"처럼 명시적으로 표시하도록 고쳤습니다.
- 합성 시간표/학생 데이터로 브라우저 종단 검증: 다른 타임에도 개설된 과목을 특정 타임으로 고정 시 정확히 그 타임으로만 2단계 교환되는지(지름길 로직이 정상적으로 우회되는지), 개설 안 된 타임으로 고정 시 대체 없이 명확히 실패하는지, 최적화 모드를 켜도 고정 결과가 그대로 유지되는지까지 확인. `tsc --noEmit`/`eslint`는 관련 파일 전체 기준 기존 베이스라인과 동일.

### 2026-07-24 (6)
**수업교체 도우미 ↔ 연수 이수증 수거 상호 이동 버튼 추가:**
- 두 서브앱이 같은 로그인 세션을 공유하는데도(위 `src/proxy.ts` 항목 참고), 서로 넘어가려면 허브를 거쳐야 했습니다. `(app)/page.tsx`와 `certificates/page.tsx` 각각의 상단 바에서 "허브로 돌아가기" 바로 옆에 `Repeat` 아이콘의 "연수 이수증 수거로 이동"/"수업교체 도우미로 이동" 링크를 추가했습니다(그냥 `next/link`라 서버 라운드트립 없이 이동, 세션 재확인 불필요). `SwapTab`의 "교체 시간표 찾기" 탭이 이미 `ArrowLeftRight` 아이콘을 쓰고 있어 헷갈리지 않도록 다른 아이콘(`Repeat`)을 골랐습니다. 디스포저블 테스트 학교로 양쪽 방향 모두 실제 화면에서 버튼 노출·이동 확인, `tsc`/`eslint` 클린.

### 2026-07-24 (5)
**로그인 화면 "이메일로 로그인" 토글 라벨을 "관리자 로그인"으로 변경:**
- 관리자가 계정 관리 기능으로 교사들에게 아이디 계정을 발급해주는 흐름이 자리잡으면서, 사용자가 "이메일 로그인은 이제 사실상 관리자 전용"이라고 판단해 라벨을 변경 요청했습니다. `login/page.tsx`의 토글 버튼 텍스트만 "관리자 로그인"으로 바꾸고 아이콘도 `Mail` → `ShieldCheck`로 교체했습니다 — **기능(백엔드 권한 검증)은 바뀌지 않았습니다**: 여전히 "코드로 가입"으로 만든 이메일 TEACHER 계정도 이 탭으로 로그인은 됩니다. 순수 라벨/아이콘 변경입니다.

### 2026-07-24 (4)
**연수 이수증 수거 헤더에도 "계정 관리" 버튼 추가:**
- "계정 관리" 버튼이 시간표 교체 도우미(`(app)/page.tsx`) 헤더에만 있고 연수 이수증 수거(`certificates/page.tsx`)에는 없어서, 이수증 화면에 있을 땐 관리자가 계정 관리로 가려면 일단 교체 도우미로 돌아가야 했습니다. `certificates/page.tsx`의 그라디언트 헤더를 `(app)/page.tsx`와 같은 `flex items-start justify-between` 구조로 바꾸고, `isAdmin`일 때만 보이는 "계정 관리" 링크(`UserPlus` 아이콘, `bg-white/15` 스타일)를 똑같이 추가했습니다. 디스포저블 테스트 학교로 관리자 화면에 버튼이 뜨고 실제 클릭 시 `/apps/schedule-helper/accounts`로 이동하는지 확인, `tsc`/`eslint` 클린.

### 2026-07-24 (3)
**관리자용 "전체 가입 인원" 조회/삭제 기능 추가:**
- "관리자가 학교에 가입된 전체 인원 명단을 보고 관리할 수 있으면 좋겠다"는 요청. 기존 `/apps/schedule-helper/accounts` 페이지의 "아이디 로그인 계정 목록"은 관리자가 발급한 아이디 계정만 보여줬고, 셀프가입(이메일)으로 들어온 교사는 학교 안 어디에서도 관리자가 목록으로 볼 방법이 없었습니다.
- `GET /api/schedule-helper/members`(admin-only, 같은 학교의 `User` 전체를 `email`/`loginId`/`role`/`createdAt` 포함해 반환)와 `DELETE /api/schedule-helper/members/[id]`(admin-only)를 신설했습니다. 삭제는 (1) 대상이 같은 학교 소속인지, (2) 관리자 본인이 아닌지, (3) 대상이 그 학교의 마지막 `ADMIN`이 아닌지 — 세 가지를 서버에서 확인한 뒤 `prisma.user.delete()`만 호출합니다. `Session`/`Account` 모델이 이미 `User`에 `onDelete: Cascade`로 연결되어 있어(스키마 확인 후 결정) 세션/계정 행을 따로 지울 필요가 없었습니다.
- `(app)/accounts/page.tsx` 최상단에 "전체 가입 인원" 카드를 새로 추가 — 이름/역할(관리자·교사 배지)/로그인 방식(이메일·아이디 배지)+식별자, 본인 행은 "(나)" 표시와 함께 삭제 버튼을 숨깁니다. 삭제는 기존 `HistoryTab.tsx` 등에서 쓰던 `window.confirm(...)` 확인 패턴을 그대로 재사용했습니다.
- 디스포저블 테스트 학교로 종단 검증: 관리자1+이메일 셀프가입 교사1+아이디 발급 교사1을 만들어 목록에 셋 다 뜨는지, 비관리자가 이 API를 호출하면 403인지, 관리자가 본인 삭제를 시도하면 400(학교의 유일한 관리자이기도 해서 "마지막 관리자" 조건과 "본인" 조건이 함께 걸리는 경우까지 확인)인지, 이메일 계정 삭제 후 그 계정으로 재로그인이 실제로 막히는지, 아이디 계정을 삭제하면 "전체 가입 인원"과 기존 "아이디 로그인 계정 목록" 양쪽에서 동시에 사라지는지까지 전부 API 직접 호출 + 실제 화면 렌더링(본인 행에 삭제 버튼이 안 뜨는지)으로 확인. `tsc --noEmit`/`eslint` 클린.

### 2026-07-24 (2)
**아이디 로그인의 "학교 코드" 입력을 "학교 검색·선택"으로 교체 + 아이디에 한글 허용:**
- 사용자가 "학교 코드를 입력하는 이유는 결국 학교를 구분하기 위해서인데, 그냥 로그인하는 사람이 학교를 검색해서 선택하게 하면 되지 않냐"고 지적. 신규 공개 라우트 `GET /api/schedule-helper/schools/search?q=`(세션 불필요, `School.name` `contains` 부분 일치, `{id,name}`만 반환하고 `joinCode` 등은 노출하지 않음)를 추가하고, `login/page.tsx`의 아이디 로그인 모드에서 "학교 코드" 텍스트 입력을 `TrainingTitleSelect.tsx`와 같은 스타일의 검색형 콤보박스(입력 → 결과 목록 클릭 → 선택된 학교 칩 + "변경" 버튼)로 교체했습니다. `POST /api/schedule-helper/login-id`도 `schoolJoinCode` 대신 `schoolId`를 직접 받도록 단순화(이미 `(schoolId, loginId)`로 User를 조회하고 있어서 `joinCode`→School 조회 단계 자체가 통째로 필요 없어짐). 기존 `School.joinCode`/"코드로 가입"(이메일 셀프가입) 흐름은 그대로 유지 — 아이디 로그인 전용으로만 코드가 필요 없어진 것입니다.
- **아이디에 한글 허용**: `LOGIN_ID_REGEX`를 `가-힣`을 포함하도록 완화하기 전에, `node_modules/zod/v4/core/regexes.js`의 `email` 정규식(`/^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@.../`)을 직접 읽어 **로컬파트에 비ASCII 문자가 전혀 허용되지 않는다**는 걸 먼저 확인했습니다. 기존 설계(`synthesizeEmail(loginId, schoolId)`가 아이디 문자를 이메일 로컬파트에 그대로 넣음)를 그대로 두고 한글만 허용하면, 계정 생성(Prisma 직접 생성이라 통과)은 되지만 로그인(`auth.api.signInEmail`이 내부적으로 `z.email()` 검증)이 100% 실패하는 상황이 됩니다. `login-id/route.ts`가 로그인 시점에 이메일을 아이디로부터 재계산하지 않고 이미 `(schoolId, loginId)`로 찾은 User 행의 저장된 이메일을 그대로 쓴다는 걸 코드로 재확인한 뒤, **`synthesizeEmail`을 아이디 문자와 완전히 무관하게 만들어**(`${userId}@login.internal`, userId는 항상 ASCII·전역 유일) 이 문제를 근본적으로 없앴습니다 — 아이디에 어떤 문자를 넣어도 이메일 검증과 무관해집니다.
- 디스포저블 테스트 학교 두 곳(API 직접 호출 1곳 + 브라우저 UI 클릭 1곳)으로 종단 검증: 학교 검색이 이름 부분 일치로 정확히 걸러지고 `{id,name}`만 반환하는지, 관리자가 한글 아이디(`이순신쌤`, `홍길동845`) 계정을 만들어도 관리자 자신의 세션이 안 바뀌는지(기존 세션 클로버링 버그 재발 여부 재확인), 그 한글 아이디로 학교 검색→선택→로그인이 실제 브라우저 클릭으로 성공하는지, 잘못된 비밀번호·존재하지 않는 schoolId가 여전히 정보 누출 없이 401로 막히는지까지 확인. `tsc --noEmit`/`eslint`(변경 파일 범위) 클린.

### 2026-07-24
**선택과목 변경 탭 7단계(다년도 분석) 중복 감지 버그 수정 + 사회/과학 미이수 표시 + UI 통일:**
- **중복 감지 버그**: 사용자가 "과거에 이미 이수한 과목을 2학기에 또 선택했는데 중복으로 안 걸린다"고 스크린샷으로 제보(예: 과거 이수 과목에 "고전과 윤리", 2학기 선택에 "고전과윤리"). 사용자는 띄어쓰기 문제일 거라 추측했지만, `useStep6Data.ts`의 `duplicateSubjects` 계산 코드를 직접 읽어보니 애초에 **2학기 과목끼리만 비교하고 `completedBefore`(과거 이수 과목)는 비교 대상에 아예 없었던** 게 진짜 원인이었습니다(단순 정규화 문제가 아니었음). `normalizeSubjectName`(공백 제거 + 유니코드 로마자→영문 통일, 위계 검사에서 이미 쓰던 함수)로 과거 이수 과목과 2학기 선택 과목을 함께 정규화 비교하도록 고쳐서, 띄어쓰기·로마자 표기 차이와 무관하게 과거 재이수든 2학기 내 중복 선택이든 모두 잡히게 했습니다.
- **사회/과학 미이수 표시**: "사회 또는 과학 이수 학점이 0이면 비고란에 표시해달라"는 요청으로 `Step6Row.missingCategories`(`("사회"|"과학")[]`) 필드를 추가하고, 기존 비고 항목들(기초과목 초과=빨강, 중복선택=노랑, 위계 위반=청록)과 겹치지 않는 **보라(`text-violet-700`)**로 "OO 과목 이수 필요"를 표시했습니다. 엑셀 다운로드(`useChangeExports.ts`)의 비고 열에도 동일하게 반영.
- **2학년/3학년 토글 색상 통일**: 7단계(`AnalysisStep.tsx`)만 다른 단계들과 다르게 선택된 학년 버튼이 회색(`bg-stone-200`)이었던 걸 발견(스크린샷 제보) — 나머지 모든 단계가 쓰는 `bg-amber-500 text-stone-900 shadow-md`로 통일했습니다.
- **2학기 과목 셀 스타일 변경**: "특이사항이 있는 과목을 학번/이름 열처럼 셀 전체 배경색으로 표현하고, 과목명을 감싸던 작은 배지(bubble)는 없애달라"는 요청으로, 과목 셀 안의 `inline-block rounded` 배지 span을 제거하고 `<td>` 자체에 배경색을 입히는 방식으로 바꿨습니다. 위계 위반(청록) > 중복선택(노랑) > 학생 직접 변경(호박) 순으로 하나의 배경색만 적용하고, 직접 변경자가 동시에 중복/위계 문제도 있으면 셀 안쪽 테두리(`ring-inset ring-amber-400`)로만 겹쳐 표시해 배경색이 섞이지 않게 했습니다.
- 네 가지 모두 `tsc --noEmit`/`eslint`(변경 파일 범위) 클린 확인. 학년 토글 색상 변경은 브라우저에서 실제 클릭해 `bg-amber-500` 적용을 확인했고, 나머지(중복 감지·미이수 표시·셀 배경색)는 학생 데이터 업로드가 필요해 코드 검증까지만 진행 — 실제 데이터로 화면 확인은 사용자 후속 확인 필요.

### 2026-07-23
**관리자 계정 발급 + 이메일 아닌 아이디 로그인 + 엑셀 일괄 생성 (같은 날 다섯 번째 요청):**
- "관리자가 초대코드로만 가입받던 방식에 더해 아이디를 직접 부여할 수 있어야 하고, 그 아이디는 이메일 형식이 아니어도 되며, 엑셀로 일괄 생성도 가능해야 한다"는 요청. 계획 단계에서 AskUserQuestion으로 4가지를 확인: (1) 기존 초대코드 셀프가입은 유지, (2) 아이디 중복은 학교 안에서만 검사, (3) 일괄 생성 시 초기 비밀번호는 관리자가 배치 전체에 적용할 고정값, (4) 로그인 후 스스로 비밀번호를 바꾸는 기능(기존엔 전혀 없었음)도 함께 추가.
- 코드로 직접 확인한 핵심 제약: better-auth의 `signIn.email`/`signUp.email`은 `z.email()`을 서버에서 강제해 이메일 형식이 아닌 문자열로는 로그인 자체가 불가능하고, 공식 `username` 플러그인은 전역 유일성만 지원해 "학교 안에서만 유일" 요구와 맞지 않아 채택하지 않았습니다. 대신 `User.loginId`(`@@unique([schoolId, loginId])`)를 내부 합성 이메일에 매핑하고, 로그인은 학교 코드(기존 `joinCode` 재사용)+아이디+비밀번호를 받는 커스텀 라우트(`POST /api/schedule-helper/login-id`)가 `auth.api.signInEmail`을 내부적으로 호출해 처리합니다. 자세한 설계는 위 "라우팅 & 인증 게이트" 섹션의 "관리자 직접 계정 발급" 항목 참고.
- **실제로 겪은 버그**: 처음엔 계정 생성에도 `auth.api.signUpEmail`을 썼는데, better-auth의 `nextCookies()`가 그 호출 즉시 새로 만든 계정으로 로그인 세션 쿠키를 덮어써서 **관리자가 방금 만든 교사 계정으로 자기 세션이 바뀌어버리는** 문제를 디스포저블 테스트로 실제 재현했습니다(admin이 계정 하나 만들자마자 `/api/auth/get-session`이 그 교사 이름을 반환). `createLoginIdAccount()`가 `better-auth/crypto`의 `hashPassword`로 직접 해시하고 `User`+`Account`를 Prisma로 직접 생성하는 방식으로 바꿔 해결(관리자 세션이 그대로 유지되는지 `get-session` 비교로 재확인).
- 관리자 강제 비밀번호 재설정(`reset-password` 라우트)도 같은 이유로 `auth.api`를 거치지 않고 `hashPassword` + Prisma 직접 갱신. 스스로 비밀번호 변경은 better-auth 코어 내장 `/change-password`를 `authClient.changePassword`로 그대로 사용(별도 API 라우트 불필요).
- 엑셀 업로드 검증 시 `xlsx` 라이브러리 base64 왕복이 브라우저 JS 컨텍스트로 옮기는 과정에서 손상되는 문제를 겪어("Unsupported ZIP file"), 이후로는 Node 스크립트(`node -e`)에서 실제 `.xlsx` 파일을 디스크에 쓰고 `fetch`+`FormData`+쿠키로 직접 서버에 요청하는 방식으로 전환해 검증했습니다 — 앞으로 xlsx 업로드 라우트를 자동화 테스트할 땐 base64 재구성 대신 이 방식을 쓰세요.
- disposable 테스트 학교로 단건 생성(관리자 세션 유지 확인), 잘못된 아이디 형식 거부, 중복 아이디 거부, 엑셀 일괄 생성(3행 중 중복 1행만 skip 리포트), 아이디 로그인 성공/실패(잘못된 학교코드·비밀번호·존재하지 않는 아이디), 관리자 강제 비밀번호 재설정(본인 시도는 403, 관리자는 200, 재설정 후 구 비밀번호 실패·신규 비밀번호 성공), 스스로 비밀번호 변경(better-auth Origin 체크 포함), 기존 이메일 셀프가입 회귀까지 실제 UI 클릭 + API 호출로 전부 종단 검증. `tsc --noEmit`/`eslint` 클린.

**제출 내역 삭제 + 재사용 가능한 명단 프리셋 + 탭 개편(연수목록 관리 신설·연수별 전용 명단):**
- **제출 내역 삭제**: `DELETE /api/schedule-helper/certificates/[id]`(본인 또는 관리자) 신규 추가, `HistoryTab.tsx`에 삭제 버튼(확인창 포함) 연결. `fileBytes`가 행 자체에 저장되므로 행 삭제만으로 첨부파일도 함께 삭제됩니다.
- **명단 프리셋 관리(`CertificateRosterPreset`)**: "QR 서명 세션을 만들기 전에 명단을 표로 보고 인원을 추가해 확정하고 싶다"는 요청에서 시작해, "용도별로 저장해두고 재사용하고 싶다"는 후속 요청으로 발전했습니다. 자세한 내용은 위 "📜 연수 이수증 수거" 섹션의 `CertificateRosterPreset`/`RosterTable.tsx` 항목 참고. `sessions/route.ts` POST가 `roster`/`rosterPresetName`을 선택적으로 받아, 명시하면 그 명단이 모든 연수에 동일 적용되고 생략하면(이번 탭 개편 이후) 연수별 전용 명단이 자동 적용됩니다.
- **탭 개편 + 연수별 전용 명단**: 실제 화면 스크린샷을 보여준 사용자가 "연수목록 관리를 첫 탭으로 신설해 연수 제목 등록 시 참여명단도 함께 등록하고, 연수마다 다른 명단이 적용되게 해달라"고 요청했습니다. 확인 질문에 대한 답변으로 (1) 일괄확인은 연수별 전용 명단 기준으로 바뀌고, (2) 복수연수 QR 세션은 "서명 1건은 세션당 1행 그대로 유지하되, 인쇄 시 연수별로 해당자만 걸러서 따로 출력"하도록 확정됐습니다(교집합 인원은 양쪽 다, 한쪽에만 속한 인원은 그쪽에만). `TrainingTitle.rosterSnapshot` + `SignSession.titleRosters`(세션 생성 시점 연수별 스냅샷) 추가로 구현했고, `sessions/[id]/route.ts`(공개 익명 라우트)와 `sign/route.ts`(서명 제출)는 이미 flat 합집합 기준으로 동작 중이라 **변경 불필요**였습니다(코드 직접 확인 후 무변경으로 결론). 새 첫 탭 `TrainingTitleManager.tsx`는 로그인 전원에게 보이되 편집/삭제는 관리자 또는 등록자 본인만 가능(`bulk-check`와 동일 권한 패턴). `TrainingTitleSelect.tsx`(제출하기 탭)의 인라인 "새 연수로 등록" 기능은 제거하고 "연수목록 관리" 탭으로 일원화했습니다.
- 세 기능 모두 disposable 테스트 학교로 실제 종단 검증(권한 경계, 회귀 없음, 삭제 후 파일도 함께 사라짐, 복수연수 인쇄 분리 등)을 마쳤고, `tsc --noEmit`/`eslint` 신규·변경 파일 범위 클린.
- **연수목록 관리 UX 개선 + 이수증/서명 카테고리 분리 (탭 개편 직후 후속 요청)**: (1) "새 연수 등록 후 프리셋을 바로 쓰고 싶다"는 피드백에 따라, 작은 `<select>`에 숨어있던 "프리셋에서 불러오기"를 눈에 띄는 칩 버튼 목록으로 바꿔 클릭 한 번에 명단이 채워지도록 `TrainingTitleManager.tsx`를 수정. (2) "명단 프리셋 관리도 연수목록 관리 메뉴여야 한다"는 요청으로 `RosterPresetManager`를 "서명받기" 탭에서 "연수목록 관리" 탭으로 이동(처음엔 "서명받기 탭에도 유지"였다가 이번에 "서명받기 탭에서는 삭제하자"로 정정됨 — `SignTab.tsx`엔 프리셋 선택 셀렉트만 남고 관리 UI는 없음). (3) "연수명단을 이수증 수거와 QR서명으로 분리해서 보여달라"는 요청으로 `TrainingTitle.category`(`"certificate"|"sign"`) 필드를 추가하고, "연수목록 관리" 탭을 3개 서브 탭(이수증 수거 관리/서명 연수 관리/명단 프리셋 관리)으로 재구성한 `TrainingListManager.tsx`를 신설(`TrainingTitleManager`에 `category` prop을 받아 재사용). 제출하기·서명받기 각각의 연수 선택창이 알맞은 카테고리만 보여주도록 필터링. 자세한 내용은 위 "📜 연수 이수증 수거" 섹션의 `TrainingTitle`/`CertificateRosterPreset` 항목 참고. 실제 프로덕션 DB에 `TrainingTitle` 행이 0개임을 SSH로 확인한 뒤 `category` 기본값(`"certificate"`)을 안전하게 정함. disposable 테스트 학교로 카테고리 격리·프리셋 공유·필터링 모두 종단 검증, `tsc`/`eslint` 클린.
- **로그인 후 원래 앱으로 복귀 (같은 날 네 번째 후속 요청)**: "시간표 교체 도우미에서 로그인하면 교체 도우미로, 연수 이수증 수거에서 로그인하면 이수증 수거로 돌아왔으면 좋겠고, 대신 한 번 로그인하면 둘 다 로그인돼 있어야 한다"는 요청. 후자(공유 로그인)는 이미 두 서브앱이 같은 better-auth 세션 쿠키를 쓰고 있어 구조적으로 충족된 상태였음을 실제로 로그인 없이 다른 앱으로 이동해보는 것으로 확인했고, 전자(복귀 목적지)만 실제 버그였습니다 — `proxy.ts`의 미인증 리다이렉트와 양쪽 페이지의 로그아웃 버튼이 전부 `/apps/schedule-helper/login`으로 목적지 정보 없이 고정 이동했기 때문입니다. `next` 쿼리 파라미터로 목적지를 실어 나르도록 고치고, 오픈 리다이렉트 방지용 화이트리스트 검증(`/apps/schedule-helper`로 시작하는 경로만 허용)을 추가했습니다. 자세한 내용은 위 "🛠️ 아키텍처" 섹션의 `src/proxy.ts` 항목 참고. 디스포저블 테스트 학교로 (1) 로그아웃 상태에서 이수증 수거 URL 직접 방문 → 로그인 → 이수증 수거로 복귀, (2) 로그인 상태에서 다른 서브앱으로 이동 시 재로그인 불필요, (3) 교체 도우미에서 로그아웃 → 재로그인 → 교체 도우미로 복귀, (4) `next`에 외부 URL을 넣어도 무시되고 기본 경로로 폴백 — 네 가지를 모두 실제 브라우저 폼 제출로 검증, `tsc`/`eslint` 클린.
- **명단 프리셋 권한 완화 + 내역조회 확장 (같은 날 세 번째 후속 요청)**: "연수목록 관리에서 새 연수 등록과 명단 프리셋은 왜 관리자만 가능하냐, 일반 교사도 가능해야 한다"는 지적에서 시작. 실제로는 `TrainingTitle` 등록(`training-titles` POST)은 이미 로그인 전원에게 열려 있었지만, 그 UI 흐름이 내부적으로 호출하는 `roster-presets/base`(기본 명단 조회, 새 연수/프리셋 만들기 시작값)와 `roster-presets` GET/POST 전부가 admin-only(403)라서 실질적으로 새 연수 등록도, 프리셋 생성도 막혀 있었던 게 진짜 원인이었습니다. `roster-presets/{route.ts, base/route.ts}` GET/POST의 admin 체크를 제거하고, `[id]/route.ts` PATCH/DELETE는 관리자 OR 프리셋 생성자 본인(`createdBy`, `TrainingTitle`과 동일 패턴)으로 바꿨습니다(`CertificateRosterPreset`에 `createdBy` select 추가). 동시에 사용자가 "내가 제출한 것도 봐야 하지만 내가 등록한 연수에 누가 제출했는지도 알아야 한다"고 요청해, `certificates/history` GET의 일반 교사 분기를 `teacherName === 본인 OR trainingTitle IN (본인이 registeredByName인 TrainingTitle 제목들)`로 확장했습니다 — 단 삭제 버튼(`HistoryTab.tsx`)은 `isAdmin || row.teacherName === myName`일 때만 노출해, 등록자라고 남의 제출을 지울 권한까지 주지는 않습니다(서버 `DELETE /certificates/[id]`도 여전히 본인/관리자만이라 UI와 서버가 일치). disposable 테스트 학교(관리자+교사A+교사B)로 프리셋 소유권 경계·본인 외 프리셋 편집/삭제 403·내역조회 교집합·삭제 버튼 노출 여부까지 실제 UI 클릭으로 종단 검증, `tsc`/`eslint` 클린.

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
