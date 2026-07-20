import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { Role } from "@/types/domain";

const protectedRoutes: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/dashboard/patient", roles: ["PATIENT", "ADMIN"] },
  { prefix: "/dashboard/doctor", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/dashboard/obsidiana", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/dashboard/admin", roles: ["ADMIN", "STAFF"] },
  { prefix: "/dashboard/assistant", roles: ["ASSISTANT", "ADMIN"] }
];

async function readRole(request: NextRequest): Promise<Role | null> {
  const token = request.cookies.get("vitaeon_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    return verified.payload.role as Role;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const rule = protectedRoutes.find((route) => request.nextUrl.pathname.startsWith(route.prefix));
  if (!rule) return NextResponse.next();

  const role = await readRole(request);
  if (!role || !rule.roles.includes(role)) {
    const login = new URL("/", request.url);
    login.searchParams.set("auth", "required");
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
