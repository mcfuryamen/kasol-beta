import { JSX } from "preact";
import { DarkModeSync } from "@/logic/hooks/use-dark-mode";

export function AuthLayout({ children }: { children: JSX.Element }) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <DarkModeSync />
      {children}
    </div>
  );
}
