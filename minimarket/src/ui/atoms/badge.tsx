import type { ComponentChildren } from "preact";

type BadgeColor = "orange" | "green" | "red" | "blue" | "yellow" | "gray" | "purple";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  color?: BadgeColor;
  size?: BadgeSize;
  children: ComponentChildren;
  class?: string;
}

const colors: Record<BadgeColor, string> = {
  orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  green:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  red:    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  blue:   "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  gray:   "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
};

export function Badge({ color = "orange", size = "md", children, class: cls }: BadgeProps) {
  const sz = size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs";
  return (
    <span class={`inline-flex items-center font-medium rounded-full ${sz} ${colors[color]} ${cls || ""}`}>
      {children}
    </span>
  );
}
