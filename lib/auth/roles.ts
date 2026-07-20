import type { Role } from "@/types/domain";

const permissions = {
  PATIENT: ["appointments:read:own", "appointments:create", "profile:update:own"],
  DOCTOR: ["appointments:read:assigned", "availability:update:own", "doctor-profile:update:own"],
  STAFF: ["appointments:read", "appointments:update", "patients:read:limited"],
  ADMIN: ["*"],
  ASSISTANT: ["appointments:read:assigned", "appointments:create:behalf", "availability:read:assigned"]
} satisfies Record<Role, string[]>;

export function can(role: Role, permission: string) {
  return permissions[role].includes("*") || permissions[role].includes(permission);
}

export function assertRole(role: Role | undefined, allowed: Role[]) {
  if (!role || !allowed.includes(role)) {
    throw new Error("FORBIDDEN");
  }
}
