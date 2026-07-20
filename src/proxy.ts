import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/apps/schedule-helper/login", "/apps/schedule-helper/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.redirect(new URL("/apps/schedule-helper/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/apps/schedule-helper/:path*"],
};
