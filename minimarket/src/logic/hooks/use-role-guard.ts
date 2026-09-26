import { currentUser } from "@/logic/state/app-state";
import type { UserRole } from "@/logic/services/auth-service";

export function useRoleGuard(allowed: UserRole[]): boolean {
  const user = currentUser.value;
  if (!user) return false;
  return allowed.includes(user.role);
}
