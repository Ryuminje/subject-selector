import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/apps/schedule-helper/login",
  "/apps/schedule-helper/signup",
  // QR로 접속한 교사가 로그인 없이 서명하는 페이지 — 세션 id 자체가 접근 통제입니다.
  "/apps/schedule-helper/certificates/sign",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const loginUrl = new URL("/apps/schedule-helper/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/apps/schedule-helper/:path*"],
};
