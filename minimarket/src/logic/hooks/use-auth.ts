import { currentUser, isAuthenticated } from "@/logic/state/app-state";
import { authService } from "@/logic/services/auth-service";

export function useAuth() {
  return {
    user: currentUser.value,
    isAuthenticated: isAuthenticated.value,
    login: authService.login.bind(authService),
    loginAsDemo: authService.loginAsDemo.bind(authService),
    logout: authService.logout.bind(authService)
  };
}
