import { JSX } from "preact";
import { useDarkMode } from "@/logic/hooks/use-dark-mode";

export function AuthLayout({ children }: { children: JSX.Element }) {
  useDarkMode();
  return (
    <div class="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
