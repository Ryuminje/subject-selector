# AI 에이전트 작업 히스토리 및 규칙 (AGENTS.md)

> ## 🚧 지금 진행 중인 일 (2026-09-10 갱신)
>
> **타임(구획) 배정 프로토타입이 `prototypes/time-allocation/`에 들어와 있습니다 (브랜치
> `feature/time-allocation-prototype`).** 아직 `src/`에 연결되지 않은 독립 실행 파일이며,
> 이식하려면 그 폴더의 `README.md`를 먼저 읽으세요 — 알고리즘·이미 잡은 버그·이식 계획이
> 전부 거기 정리돼 있습니다. 아래 "🧭 타임(구획) 배정" 섹션도 참고.
>
> **아직 답을 못 받은 것 (사용자에게 확인 필요, 그대로 남아 있음):**
> - 타임 배정을 `enrollment-helper`의 네 번째 탭으로 넣을지, 별도 앱으로 만들지
> - 타임 배정 결과를 DB에 저장할지 (저장하면 `prisma/schema.prisma` 변경 필요)
> - 타임 배정 화면의 "인원설정 고정" 체크박스가 원래 학교 도구에서 뜻하던 의미가 맞는지
>   (지금은 "최적화 시 그 과목의 분반 타임을 유지"로 해석해 구현)
> - 보강원 서식(`makeup/print`)의 칸 비율이 실제 종이와 맞는지
> - 교체를 한 줄로 적는 게 학교 결재 관행과 맞는지
> - `물리학II`처럼 로마숫자가 붙은 과목이 `parseClassInfo`(`lib/utils.ts`)에서 이동수업("I블록")으로
>   잘못 인식되는 기존 버그를 고칠지 — 아직 아무 커밋도 이걸 건드리지 않았습니다.
>
> **⚠️ 확인 필요 (개인정보):** 이 저장소의 GitHub 원격(`Ryuminje/subject-selector`)은 **공개**
> 상태인데 `samples/sample3.xlsx` 등에 실제 학생 이름·학번이 들어 있습니다. 프로토타입의
> 실제 배정 자료(`prototypes/time-allocation/analysis/*.csv`)는 이 때문에 커밋하지 않고
> `.gitignore`로 막아 뒀습니다. 기존 `samples/`는 사용자 판단이 필요해 그대로 두었습니다.


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

**`AppSwitcher` — 같은 부서 앱 사이를 오가는 헤더 드롭다운 (2026-08-06 추가)**: `src/features/schedule-helper/components/AppSwitcher.tsx`. 예전에는 각 앱 헤더에 "○○로 이동" 링크를 손으로 하나씩 넣었는데, 앱이 3개가 되자 헤더가 길어지고 **한 화면에만 링크를 빠뜨리는 일**이 실제로 생겼습니다(시간표 교체 도우미에 "업무 AI 파트너" 링크가 없었음). 지금은 현재 앱 이름이 적힌 버튼 하나에 마우스를 올리면 같은 부서 앱 전체가 펼쳐집니다. **목록은 `src/config/hub.ts`에서 직접 읽으므로, 새 앱을 허브에 등록하면 모든 화면의 드롭다운에 자동으로 나타납니다 — 헤더를 손볼 필요가 없습니다.** 현재 앱은 `usePathname()`과 가장 길게 겹치는 `href`로 판정합니다(`/apps/schedule-helper`와 `/apps/schedule-helper/certificates`가 둘 다 걸리므로 최장 일치가 필요). 호버뿐 아니라 클릭으로도 열리고(터치 기기), 바깥 클릭·Esc로 닫힙니다. `tone` prop으로 배색을 맞춥니다 — 2026-08-30 디자인 개편으로 `swap`(시간표 교체 도우미, 깊은 소나무 `#1F5C52`) / `cert`(연수 이수증 수거, 남색 관인 `#3B4A7A`) / `assist`(업무 AI 파트너, 세이지 `#5C6B4F`) 세 톤으로 바뀌었습니다(예전엔 teal/amber 둘뿐이었음). 색 토큰은 `src/app/globals.css`의 `@theme` 블록에 `--color-swap`/`--color-cert`/`--color-assist`로 정의돼 있고, 기존 exam-scheduler가 쓰는 `--color-surface` 등과 이름이 겹치지 않게 일부러 따로 뒀습니다.

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

- **5개 탭과 접근 범위 (2026-07-23 탭 개편, 같은 날 권한 완화 후속 수정 포함)**: **연수목록 관리**(첫 번째 탭, 로그인 전원 노출, 내부에 3개 서브 메뉴 — 아래 항목 참고, "새 연수 등록"과 "명단 프리셋 만들기" 둘 다 로그인한 아무나 가능) / 제출하기(로그인 전원, 본인 이름은 `resolveTeacherName(session.user)`로 서버가 강제 — 클라이언트가 이름을 자유 입력할 수 없어 스푸핑 불가) / 내역조회(관리자는 전체 검색, **일반 교사는 본인 제출 내역 + 본인이 등록한 연수(`registeredByName`)에 다른 교사가 제출한 내역까지 함께 봄** — "누가 등록했는지"와 "누가 제출했는지"가 별개 권한이라, 등록자는 자기 연수의 제출 현황을 알아야 한다는 요청으로 2026-07-23 확장. 단 삭제 버튼은 여전히 본인 제출 건에만 노출 — 등록자라고 남의 제출을 지울 권한은 아님) / 일괄확인(관리자 또는 해당 연수의 등록자만 — 이제 그 연수에 등록된 전용 명단 기준으로 제출/미제출 계산, 아래 `TrainingTitle` 참고) / 서명받기 QR(**QR 세션 열기·인쇄는 관리자 또는 그 연수를 등록한 본인만 — 2026-08-29부터, 아래 히스토리 로그 참고. 여러 연수를 묶는 "복수 연수 세션"만 계속 admin-only**. 세션 자체는 원본 그대로 **완전 익명** 유지 — 세션 cuid 자체가 유일한 접근 통제라는 트레이드오프를 사용자가 명시적으로 승인함).
- **`resolveTeacherName(user)`** (`src/features/schedule-helper/lib/resolveTeacherName.ts`) — `user.teacherId`가 있으면 그 `Teacher.name`, 없으면 `user.name` 폴백. 제출/내역조회/일괄확인/연수삭제/연수 전용 명단 편집 전부 이 헬퍼로 신원을 서버에서 재확인하고, 클라이언트가 보낸 이름은 절대 신뢰하지 않습니다.
- **`TrainingTitle` 레지스트리 + 연수 전용 참여명단 + 이수증/서명 카테고리 분리 (2026-07-23)**: "연수 제목"은 자유 텍스트가 아니라 사전 등록제입니다. 로그인한 아무나 새 연수를 등록할 수 있고(`POST /api/schedule-helper/certificates/training-titles`, `@@unique([schoolId, title])`), 등록된 연수는 전 교사가 제출 가능(`submit`이 등록 여부를 검사, 미등록 연수 제출 시 400)합니다. 등록 시 그 연수 전용 참여명단(`rosterSnapshot: String?`, JSON string[], 순서 보존)을 함께 지정할 수 있고 — null이면 `getCertificateRoster()` 전체 기본 명단으로 폴백합니다. **`category: String @default("certificate")`**("certificate" | "sign")로 이 연수가 이수증 제출용인지 QR 서명용인지 구분합니다 — 사용자가 직접 고르는 필드가 아니라, 관리 화면의 어느 서브 메뉴에서 만들었는지로 서버가 자동 태깅(`body.category === "sign" ? "sign" : "certificate"` coercion, 사용자 입력 검증 아님). 이 분리 덕에 제출하기 탭(`TrainingTitleSelect.tsx`)은 `category === "certificate"`만, 서명받기 탭(`TrainingTitleMultiSelect.tsx`)은 `category === "sign"`만 필터링해서 보여줍니다(같은 `useTrainingTitles()` 훅으로 전체를 받아 각자 클라이언트에서 필터 — 서버 쿼리 파라미터 추가 없음). **일괄확인 조회·삭제·명단 편집(`PATCH .../training-titles/[id]`)은 관리자 또는 그 연수를 등록한 본인(`registeredByName`)만 가능**. 관리 UI는 `TrainingListManager.tsx`("연수목록 관리" 탭 본문 — 이수증 수거 관리/서명 연수 관리/명단 프리셋 관리 3개 서브 탭을 갖는 얇은 컨테이너)가 `TrainingTitleManager.tsx`(`category` prop을 받아 그 카테고리만 필터링해 보여주는 재사용 컴포넌트, `RosterTable` edit 모드 + "프리셋에서 바로 불러오기" 칩 버튼)를 카테고리별로 두 번 렌더링합니다. `TrainingTitleSelect.tsx`(제출하기 탭)는 순수 검색·선택 콤보박스입니다 — 예전엔 여기서도 인라인으로 새 연수를 등록할 수 있었지만, 등록은 반드시 명단·카테고리와 함께 이뤄지도록 "연수목록 관리" 탭으로 일원화하면서 인라인 등록 기능을 제거했습니다.
- **파일/서명 저장**: `TrainingCertificate.fileBytes`, `SignSessionSignature.signaturePng` 모두 Prisma `Bytes`(Postgres `bytea`)로 행에 직접 저장, 별도 오브젝트 스토리지 없음. 스트리밍 라우트(`[id]/file`, `signatures/[id]/image`)는 `NextResponse`에 raw `Buffer` 바디 + `Content-Type`/`Content-Disposition: inline` 헤더. **`Cache-Control`은 반드시 `private, no-cache`** — 한 번 `max-age=31536000, immutable`로 뒀다가, 같은 브라우저 탭에서 로그아웃 후 다른 교사로 로그인하면 브라우저 캐시가 이전 교사의 파일을 그대로 서빙하는 실제 위험을 발견해 고쳤습니다. 새로운 bytea 스트리밍 라우트를 추가할 때 이 캐시 헤더를 그대로 복사하세요. 제출 내역은 `DELETE /api/schedule-helper/certificates/[id]`(본인 또는 관리자)로 삭제 가능 — `fileBytes`가 행 자체에 저장돼 있어 행 삭제만으로 첨부파일도 함께 지워집니다.
- **Gemini API 키**: 개발자 env var가 아니라 `School.geminiApiKey`(평문, `joinCode`와 동일한 신뢰 수준)에 학교 관리자가 직접 등록(`gemini-key` GET/PATCH, admin-only). `lib/gemini.ts`의 `analyzeCertificateImage`는 순수 `fetch` 기반 Gemini 2.5 Flash 호출이고, 실패해도 제출 자체를 막지 않고 `extractionFailed: true`로 수동 입력 폴백을 유도합니다.
- **QR 서명(`SignSession`/`SignSessionSignature`) 익명 라우트**: `sessions/[id]` GET과 `sessions/[id]/sign` POST는 로그인 검사가 **의도적으로 없습니다** — QR/URL을 아는 사람이면 누구나 로스터의 이름으로 서명 가능한, 원본 앱과 동일한 트레이드오프입니다. `src/proxy.ts`의 `PUBLIC_PATHS`에 `/apps/schedule-helper/certificates/sign`이 등록되어 있어야 이 페이지가 로그인 리다이렉트를 안 탑니다 — 나중에 "로그인 요구"로 되돌리는 방향의 수정은 이 설계를 깨는 것이니 하지 마세요. `SignSessionSignature`는 지금도 세션당 교사 1명당 1행뿐입니다(`sessionId+teacherName` unique, `trainingTitle` 필드 없음 — 원본 `Code.gs`의 `submitSignature`가 그룹의 모든 연수 시트에 동일 서명을 씀을 재확인하고 스키마에서 제거한 이력, 아래 2026-07-22 로그 참고). **2026-07-23부터 "적용 범위"는 인쇄 시점에 연수별로 분리됩니다**: 세션 생성 시 각 연수 제목의 `TrainingTitle.rosterSnapshot`을 스냅샷해 `SignSession.titleRosters`(JSON `Record<제목, string[]>`)에 저장해두고, 인쇄 라우트(`sessions/[id]/print`)가 요청된 제목 인덱스에 대해 `titleRosters[제목]`으로 걸러서 그 연수 해당자만 출력합니다 — 서명 자체는 여전히 세션당 1행이지만 "누구에게 적용되는지"는 연수별 명단 교집합으로 계산되는 구조입니다. 관리자가 "참여 명단"에서 전체 기본/프리셋을 명시적으로 고르면 `titleRosters`가 null로 남아 모든 연수에 동일 명단이 적용되는 기존 동작 그대로입니다(회귀 없음).
- **스키마**: `School.geminiApiKey`, `TrainingTitle`(`id/schoolId/title/registeredByName/rosterSnapshot/category/createdAt`), `TrainingCertificate`(`teacherName/trainingTitle/number/institution/certDate/fileName/mimeType/fileBytes`), `SignSession`(`trainingTitles`/`rosterSnapshot`는 JSON string[], `titleRosters`는 JSON Record, `rosterPresetName`, `locked`), `SignSessionSignature`(`sessionId+teacherName` unique), `CertificateRosterExtra`(아래 항목 참고), `CertificateRosterPreset`(아래 항목 참고). 관련 마이그레이션 7개: `add_training_certificates`, `simplify_sign_session_signature`(그룹서명 스키마 교정), `add_training_title_registry`, `add_certificate_roster_extra`, `add_certificate_roster_preset`, `add_training_title_and_session_roster_split`, `add_training_title_category`.
- **`CertificateRosterExtra` — 시간표에 없는 인원 보충 명단 (2026-07-22 추가)**: 일괄확인/서명 세션의 "전체 대상자" 명단은 원래 `Teacher` 테이블(=시간표 업로드 시 자동 upsert된 이름)만 봤는데, 행정직원처럼 애초에 시간표가 없는 사람을 넣을 방법이 없다는 문제가 나와서 추가했습니다. `Teacher` 테이블에 직접 끼워 넣는 대신 **완전히 별도의 명단**으로 분리한 이유: 시간표 교체 도우미(SwapTab)의 교사 목록은 `Teacher` 테이블이 아니라 `School.scheduleData.teachers`(파싱된 시간표 JSON)를 기준으로 하므로, `Teacher`에 시간표 없는 사람을 추가해도 스왑 화면에는 안 나타나 실질적으로는 안전하지만, 사용자가 "연수 이수증 기능 전용 별도 명단"을 명시적으로 선택했습니다(교사 목록 관리 화면에 뒤섞이지 않게). `src/features/schedule-helper/lib/getCertificateRoster.ts`가 `Teacher.name`과 `CertificateRosterExtra.name`을 합쳐 정렬된 전체 명단을 반환하는 단일 창구 — 새로운 "전체 대상자" 조회가 필요해지면 `prisma.teacher.findMany`를 직접 쓰지 말고 이 헬퍼를 재사용하세요. 관리 UI는 `ExtraRosterSettings.tsx`(관리자 전용, `BulkCheckTab.tsx` 상단에 렌더링) — 추가/삭제 모두 admin-only, `Teacher`/기존 `CertificateRosterExtra`와 이름이 겹치면 400.
- **`CertificateRosterPreset` — 용도별로 저장해 재사용하는 이름 붙은 명단 (2026-07-23 추가)**: `CertificateRosterExtra`(항상 기본 명단에 합산되는 flat 목록)와는 별개로, "전체 교직원", "부장단만" 같은 **이름 붙인 순서 있는 명단**을 저장해두고 QR 세션 생성 시 재사용하는 기능입니다. `names: String`(JSON string[], **재정렬 안 함 — 저장된 순서가 곧 서명부 순서**), `@@unique([schoolId, name])`, `createdBy: String`(생성자 이름, `resolveTeacherName`). CRUD는 `api/.../certificates/roster-presets/{route.ts, [id]/route.ts, base/route.ts}` — **처음엔 전부 admin-only였다가, "일반 교사도 프리셋을 만들 수 있어야 한다"는 요청으로 2026-07-23에 완화**: 생성(POST)/`base`(기본 명단 조회)는 로그인한 아무나 가능, 수정(PATCH)/삭제(DELETE)는 관리자 또는 그 프리셋을 만든 본인(`createdBy` 일치)만 가능(`TrainingTitle`의 등록자 전용 수정/삭제와 동일한 패턴). **조회(GET)는 2026-08-29부터 전체 공개가 아닙니다** — "관리자가 만든 프리셋과 개인 프리셋이 안 섞였으면 좋겠다"는 요청으로, `getAdminNames.ts`(`createdBy` 이름이 지금 관리자 명단에 있는지 실시간 조회 — 스냅샷 아님, 마이그레이션 없음)로 관리자가 만든 것만 학교 전체에 공개하고 그 외는 만든 본인에게만 내려줍니다. 응답의 `isShared` 필드로 화면이 공통/개인 여부를 압니다. UI는 `RosterPresetManager.tsx`(`isAdmin` prop + `useSession()`으로 본인 이름을 확인해 `canEdit = isAdmin || preset.createdBy === myName`일 때만 편집/삭제 버튼 노출, "관리하기" 접기 버튼 없이 항상 펼쳐짐, 공통/개인을 인디고/앰버 색으로 구분한 상하 2그리드) + `useRosterPresets.ts`. **위치 변경(2026-07-23 재정정)**: 처음엔 "서명받기" 탭에 뒀다가, 사용자가 "프리셋 만들기도 연수목록 관리에 있는 메뉴여야 해" + "서명받기 탭에서는 삭제하자"고 정정해서 지금은 `TrainingListManager.tsx`("연수목록 관리"의 "명단 프리셋 관리" 서브 탭)에만 관리 UI가 있습니다. `SignTab.tsx`엔 `useRosterPresets()`로 읽어온 `presets` 목록을 "참여 명단" 셀렉트 옵션으로만 쓰는 코드가 남아있고(세션 생성 시 override 용도), 프리셋 CRUD 자체는 없습니다 — 새로 손댈 때 이 둘(관리 vs 선택)을 다시 합치지 마세요. **`RosterTable.tsx`**가 이 프리셋과 `TrainingTitleManager`(연수 전용 명단) 양쪽에서 재사용되는 공용 표 컴포넌트로, 인쇄 페이지(`sessions/[id]/print/page.tsx`)와 동일한 남색 헤더·번호/성명/서명 2단 분할 스타일을 유지하면서 `mode="edit"`일 때 네이티브 HTML5 드래그 앤 드롭 재정렬(신규 npm 패키지 없음 — 좌우 2단 분할과 무관하게 항상 flat 배열 인덱스 기준으로 재배치)을 지원합니다. 새 프리셋/연수 명단을 만들 때 시작값은 `roster-presets/base`(=`getCertificateRoster()`)에서 받아옵니다. **홀수 인원이면(예: 55명 → 좌28/우27) 오른쪽 표 맨 아래에 빈 줄을 채워 좌우 행 수를 맞춥니다** — `renderTable(rows, padTo)`에 `half`를 넘겨 `padCount = padTo - rows.length`만큼 빈 `<tr>`을 추가하는 방식이며, `RosterTable.tsx`와 인쇄 페이지(`print/page.tsx`, 별도 구현)에 **같은 패턴을 각각** 적용했습니다 — 하나로 합쳐진 컴포넌트가 아니라서 이런 표 스타일을 또 고칠 땐 두 곳 다 확인하세요. **엑셀로 프리셋 만들기**(`parseRosterExcel.ts` — 이름 열 자동 판별, `xlsx-js-style` 사용. 서버 전용인 `sheetData.ts`의 `xlsx`와 다른 이유는 이게 **브라우저**에서 도는 클라이언트 코드라서, 이 저장소의 클라이언트 엑셀 업로드가 전부 `xlsx-js-style`인 것과 맞춘 것)와 예시 서식 다운로드(`rosterExcelTemplate.ts`)도 이 화면에 있습니다.

---

## 🤖 업무 AI 파트너(assistant) 참고 메모 — 2026-08-06 추가

`/apps/schedule-helper/assistant`. 선생님이 자기 업무 자료(PDF·DOCX·엑셀·텍스트)를 올려두면 **그 자료만 근거로** 답하는 챗봇을 만드는 기능입니다. 한 계정이 챗봇을 여러 개 만들 수 있고, **챗봇마다 자기 자료함만 검색**합니다("업무 하나 = 챗봇 하나 = 자료함 하나"). 색은 이수증 수거(teal)와 구분되도록 수강신청 도우미와 같은 크림/앰버 톤을 씁니다.

- **설계의 축은 "환각 방지"입니다.** 기재요령 같은 문서는 틀린 답이 곧 업무 사고입니다. 그래서 (1) 답변마다 근거 자료·쪽수를 칩으로 붙이고, (2) 자료에서 못 찾으면 "올려주신 자료에서는 확인할 수 없습니다"라고 답하도록 강제하며, (3) 그렇게 답한 경우 근거 칩을 자동으로 비웁니다(근거 없다는 답 옆에 근거가 붙으면 오해를 부름). 이 규칙은 `lib/assistant/chat.ts`의 `GROUNDING_RULES`에 있고, **사용자가 정한 말투(`persona`)보다 항상 뒤에 붙여** 덮어쓰지 못하게 합니다 — 순서를 바꾸지 마세요.
- **검색은 RAG**입니다. 전체 문서를 매번 프롬프트에 넣는 방식은 200쪽 PDF 기준 질문당 수백 원이 들고 느려서 배제했습니다. 업로드 → 텍스트 추출(쪽수 보존) → 조각 → 임베딩 → 질문 시 상위 8조각만 사용.
- **`lib/assistant/search.ts`가 pgvector를 만지는 유일한 파일입니다.** Prisma는 vector 타입을 못 다뤄 스키마에서 `Unsupported("vector(768)")`로 선언했고, 삽입·임베딩 채우기·유사도 검색 모두 이 파일의 raw SQL이 담당합니다. 검색 방식을 바꾸게 되면 여기만 갈아끼우면 됩니다. 조각 id는 Prisma를 거치지 않으므로 DB의 `gen_random_uuid()::text`로 만듭니다. **DB가 NAS 원격이라 항상 한 문장에 여러 행을 몰아 처리**합니다(루프 안 개별 INSERT 금지 — HISTORY.md의 2026-07-21 upload 타임아웃 교훈과 같은 이유).
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

## 🧭 타임(구획) 배정 프로토타입 참고 메모 — 2026-09-10 추가

`prototypes/time-allocation/` — **아직 `src/`에 연결되지 않은 독립 프로토타입입니다.** 빌드에
포함되지 않고 어떤 코드도 이 폴더를 import하지 않습니다. 의존성 없는 순수 HTML/CSS/JS라
`node prototypes/time-allocation/server.js`로 바로 띄워 볼 수 있습니다(포트 3000).

**상세 문서는 그 폴더의 `README.md`에 있습니다** — 알고리즘, 이미 잡은 버그, 검증 방법,
이식 계획, 미확인 결정사항까지 전부 거기 정리했습니다. 이식 작업을 시작하기 전에 반드시 읽으세요.

- **하는 일**: 수강신청 결과를 받아 과목별 분반을 타임(구획)에 배치하고, 학생을 서로 겹치지
  않게 각 분반에 배정합니다. 학생별 이분 매칭 + 언덕오르기 최적화입니다.
- **이 앱과의 관계**: 기존 `ClassOpeningStep`(수요조사·본조사)은 분반을 **몇 개** 열지까지만
  정합니다. **어느 타임에 놓고 학생을 어디 넣을지**는 이 앱에 없던 기능입니다. 반대로 이
  프로토타입의 출력은 선택과목 변경 탭의 `TimetableStep` 입력과 `StudentTimeData`
  (`src/types`) 형태와 맞물립니다 — 지금 사람이 외부 도구로 만들어 넣는 자료를 앱 안에서
  생성할 수 있게 됩니다.
- **핵심 개념 "구획(band)"**: 학점 합이 타임 시수를 넘지 않는 반 고정 공통과목 묶음으로,
  한 타임을 시수로 나눠 씁니다(예: `2학점 체육 + 1학점 진로`). 공통과목 교사가 n명이면 한
  타임에 최대 n개 반만 들어가므로 `ceil(반 수 / n)`개 타임에 흩어 배치합니다. 전체 타임 수 =
  `택N` + `구획 수`.
- **불변식 (검증 기준)**: 학생은 한 타임에 한 수업만 들으므로 **타임별 인원 합계는 항상 전체
  학생 수와 같아야 합니다.** 실제로 이 불변식으로 "같은 구획의 과목을 각각 세어 인원·반이
  부풀려지던" 버그를 잡았습니다. 집계는 반드시 과목 단위가 아니라 **구획 단위**로 하세요.

---

## 💻 다른 컴퓨터에서 이어받기 (로컬 개발환경 만들기) — 2026-08-28 추가

이 저장소는 학교 PC와 집 PC를 오가며 개발합니다. 새 컴퓨터에서 처음 받았을 때 순서입니다.

```bash
git clone https://github.com/Ryuminje/subject-selector.git
cd subject-selector
npm install          # postinstall이 prisma generate까지 함
```

**`.env.local`이 없으면 `next dev`가 아예 뜨지 않습니다.** `DATABASE_URL`이 없으면 부팅이 실패하기 때문입니다(`.env.example` 참고). 어떤 DB를 물릴지는 목적에 따라 다릅니다.

- **허브 · 수강신청 도우미 · 시험 시간표 도우미만 볼 것이라면** DB를 안 쓰므로 형식만 맞는 가짜 값이면 됩니다: `DATABASE_URL="postgresql://user:pass@localhost:5432/dev"`.
- **쌤스 헬퍼(로그인 필요)를 볼 것이라면** 진짜 DB가 필요합니다. **운영(NAS) DB에 직접 붙어 테스트하지 마세요** — 실제 학교 데이터가 들어 있습니다. 대신 Prisma에 딸려오는 로컬 DB를 씁니다(설치할 것 없음):

```bash
npx prisma dev -n local -d          # 로컬 전용 Postgres 띄우기 (백그라운드)
npx prisma dev ls                   # 접속 주소(TCP postgres://...) 확인
# 그 주소를 .env.local의 DATABASE_URL에 넣고
DATABASE_URL="<그 주소>" npx prisma migrate deploy    # 표 만들기
npm run dev
curl -X POST http://localhost:3000/api/dev-seed       # 표본 데이터 심기
```

- `npx prisma dev start <이름>` / `stop <이름>` / `rm <이름>`으로 껐다 켜고 지웁니다. **`start`는 이름을 `-n` 없이 그대로** 붙입니다(`stop`/`rm`도 동일).
- **`/api/dev-seed`**(`src/app/api/dev-seed/route.ts`)가 가상의 학교·교사 5명·시간표와 로그인 계정 **`test` / `test1234`**(관리자)를 만들어 줍니다. 여러 번 돌려도 안전하고, `NODE_ENV === "production"`이면 404를 돌려주므로 운영에 배포돼도 실행되지 않습니다. 시간표는 **교체 후보**(상대가 나와 같은 학반을 다른 시간에 가르쳐야 잡힘)와 **동과 대강 후보**(그 수업이 이동수업이어야 뜸)가 둘 다 나오도록 일부러 맞춰 짠 것이라, 조건을 모르고 고치면 후보가 하나도 안 잡힙니다.
- `prisma.config.ts`는 `.env.local`이 아니라 **`.env`** 를 읽습니다(Next.js와 다름). 그래서 prisma CLI를 쓸 때는 위처럼 `DATABASE_URL=...`을 명령 앞에 붙이는 게 확실합니다.
- 로컬에서 `npx prisma migrate dev`는 섀도 DB 때문에 실패합니다. 마이그레이션을 새로 만들 때는 `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`로 SQL을 뽑아 폴더를 직접 만들고 `migrate deploy`로 적용하세요(**그 SQL에 섞여 나오는 `DROP INDEX "AssistantChunk_embedding_idx"`는 반드시 지우고** — 위 pgvector 항목 참고).

### 운영 DB에 마이그레이션 적용하기

앱은 Vercel, DB는 NAS라 **스키마를 바꿨으면 사람이 직접 한 번 적용해야 합니다**(Vercel 자동 적용은 아직 안 걸려 있음).

- **⚠️ 이 저장소의 개발 컴퓨터(같은 랜, `192.168.0.21:55432`)에서만 진행하세요 — 2026-09-03 확인.** 이론상으로는 밖에서 `fbalswp.duckdns.org:55432`(라우터 포트포워딩)로도 닿아야 하지만, 실제로 다른 컴퓨터에서 시도했을 때 안 됐습니다(원인 미확인 — 포트포워딩·NAS 방화벽·DuckDNS 갱신 중 하나로 추정). **그러니 "아무 컴퓨터나 DB에 네트워크로 닿으면 된다"고 안내하지 말고, 항상 이 개발 컴퓨터에서 진행하도록 안내하세요.**
- **비밀번호는 Vercel에서 다시 볼 수 없습니다** — `DATABASE_URL`이 Secret 타입이라 저장 후 열람 불가입니다. NAS의 `~/docker/subject-selector-db/docker-compose.yml`(`POSTGRES_PASSWORD`)이나 개발 컴퓨터의 `.env`에서 찾으세요. Vercel 환경변수 편집 화면에서 값 칸이 비어 보이는 건 정상이며, **거기서 Save를 누르면 운영 주소가 지워집니다.**
- 적용 순서는 **마이그레이션 먼저, 코드 푸시 나중**입니다. 반대로 하면 새 코드가 없는 표를 찾습니다.

```bash
DATABASE_URL="postgresql://..." npx prisma migrate status   # 뭐가 밀렸는지 먼저 확인
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

**⚠️ AI 에이전트(Claude Code)는 이 두 명령을 스스로 실행할 수 없습니다 — 2026-09-03 확인.** 운영 DB로 보이는 곳에 대한 쓰기(`migrate deploy`)뿐 아니라 **읽기 전용 원본 SQL 조회(`$queryRawUnsafe` 등)까지** 세션의 자동 권한 분류기가 차단합니다("Blocked by classifier" — 우회 시도 금지, 차단되면 사용자에게 그대로 알리고 맡길 것). 그래서 이 작업은 **항상 사람이 직접 터미널에서 실행**해야 합니다 — 에이전트는 명령만 준비해서 건네주세요. 절차:
1. **적용 전 백업.** 이 저장소 개발 컴퓨터엔 `pg_dump`도 Docker도 안 깔려 있을 수 있습니다(2026-09-03 기준 확인됨). 그럴 땐 이미 설치된 Prisma Client로 논리 백업(JSON)을 대신 뜹니다 — 저장소 루트에 `_tmp_backup.mts`처럼 임시 파일(커밋 금지, 실행 후 삭제)을 만들어 `PrismaClient`로 스키마의 모든 모델을 `findMany()`한 뒤 파일로 저장하고, `node`가 아니라 **`npx tsx`로 실행**하세요(생성된 Prisma Client가 `.ts`라 `node`로 바로 못 돌립니다). 적용 후엔 같은 방식으로 테이블별 `count()`를 백업 파일의 행 수와 대조해 데이터 유실이 없는지 확인하세요.
2. **PowerShell에서 `npx`가 `PSSecurityException`으로 막히는 경우**: PowerShell 기본 실행 정책이 `npx.ps1`(PowerShell 스크립트 래퍼) 실행을 막아서 나는 오류입니다(`about_Execution_Policies` 참고). 정책을 바꾸지 말고 **`npx.cmd prisma migrate deploy`**처럼 `.cmd` 래퍼를 직접 부르면 우회됩니다(`cmd /c "npx ..."`도 됨).
3. 사람이 명령을 실행한 뒤, 에이전트는 `npx prisma migrate status`로 "Database schema is up to date!"를 확인하고 위 백업 대조까지 끝내야 이 작업이 완료된 것입니다.

---

## 👥 협의회 교사 프리셋(meeting-presets) 참고 메모 — 2026-08-28 추가

협의회 시간 찾기에서 자주 함께 잡는 사람들을 이름 붙여 저장해 두고 한 번에 고르는 기능입니다.

- **이 프로젝트에서 유일하게 "계정별"로 저장되는 데이터입니다.** 다른 저장물(연수 명단 프리셋, 연수 목록 등)은 전부 학교 공용인데, 협의회 상대는 사람마다 다르므로 사용자가 개인별로 요구했습니다. 그래서 `MeetingPreset`은 `schoolId`가 아니라 **`userId`로 갈라지고**, 조회·수정·삭제 라우트가 전부 `session.user.id`로만 거릅니다. 남의 프리셋은 id를 알아도 404입니다(존재 자체를 숨기려고 403이 아니라 404를 씁니다).
- **`userId`에 `@relation`을 걸지 않았습니다.** `User` 모델은 `npx auth generate`가 통째로 다시 쓰기 때문에 관계 필드를 달면 다음 생성 때 사라집니다(`User.schoolId`/`teacherId`와 같은 이유). 대신 **cascade가 없으므로 계정 삭제 시 고아 행이 남습니다** — `DELETE /api/schedule-helper/members/[id]`에 `meetingPreset.deleteMany`를 넣어 직접 지웁니다. **User에 매달리는 테이블을 새로 만들 때는 그 라우트도 같이 손봐야 합니다.**
- **⚠️ 마이그레이션을 만들 때 `prisma migrate diff`가 뱉는 `DROP INDEX "AssistantChunk_embedding_idx"`를 반드시 지우고 쓰세요.** 그 HNSW 인덱스는 Prisma 스키마로 표현할 수 없어 손으로 넣은 것이라 Prisma가 "없어야 할 인덱스"로 오해합니다. 그대로 두면 **AI 파트너의 벡터 검색 인덱스가 삭제됩니다.** 이번에도 실제로 섞여 나와서 빼고 작성했습니다(`20260821120000_add_meeting_preset`).
  - 참고로 이 로컬 환경에서는 `prisma migrate dev`가 섀도 DB 때문에 실패합니다. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`로 SQL을 뽑아 마이그레이션 폴더를 직접 만들고 `migrate deploy`로 적용했습니다.
- **프리셋을 누르면 현재 선택을 덮어씁니다**(더하지 않습니다). "저 묶음으로 바꾼다"가 원하는 동작이고, 이전 선택에 얹히는 건 대개 실수이기 때문입니다. 적용할 때 **지금 시간표에 없는 이름은 걸러냅니다** — 교사가 바뀐 뒤 남은 옛 프리셋을 그대로 넣으면 "아무 시간도 안 됨"으로 조용히 빠져 원인을 찾기 어렵습니다.
- 저장은 2명 이상일 때만 됩니다(협의회 계산 자체가 2명부터입니다). 이름은 30자, 계정당 50개까지.
- 파일: 모델 `prisma/schema.prisma`의 `MeetingPreset`, 라우트 `api/schedule-helper/meeting-presets/{route.ts,[id]/route.ts}`, 훅·UI `features/schedule-helper/components/meeting/{useMeetingPresets.ts,MeetingPresetBar.tsx}`, 붙는 곳은 `MeetingTab.tsx`의 교사 선택 패널 위.
- 이름 목록 정리는 연수 명단과 규칙이 같아 `lib/sanitizeRosterNames.ts`를 그대로 재사용합니다(공백 제거·중복 제거·**순서 보존**). 새로 만들지 마세요.

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
   - **현재 테마는 크림/앰버 라이트 테마입니다** (2026-07-19 전환, 배경 `bg-orange-50`, 카드 `bg-white/70~95 backdrop-blur-xl border-stone-200`, 포인트 컬러 amber/rose/emerald). 다크(slate-950) 테마로 되돌리지 마세요. 새 강조색 텍스트는 반드시 `-700` 이상의 진한 톤을 쓰고(옅은 `-200/-300/-400`은 흰 배경에서 시인성이 크게 떨어짐), solid/saturated 배경 버튼만 `text-white`를 유지하고 옅은(`-50/-100`) 배경 버튼은 진한 텍스트를 쓰세요. 자세한 배경은 HISTORY.md의 2026-07-19 항목 참고.
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

## 📅 개발 히스토리 로그

날짜별 작업 일지는 [`HISTORY.md`](./HISTORY.md)로 옮겼습니다 (2026-09-06, 전체 분량의 절반 이상을 차지해 매 세션 컨텍스트 낭비가 커서 분리). **작업을 마치면 새 항목은 AGENTS.md가 아니라 `HISTORY.md` 맨 위에 추가하세요.** "왜 이렇게 결정했는지", 날짜별 경위, 이미 틀렸던 가정, 실측으로 잡은 버그를 찾을 땐 그 파일을 grep하세요 — 이 파일(AGENTS.md)의 위 섹션들은 히스토리가 아니라 지금 상태에 대한 설명이라 계속 여기 남아 있습니다.
