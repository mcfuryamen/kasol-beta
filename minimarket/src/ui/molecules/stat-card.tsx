import { JSX } from "preact";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: JSX.Element;
  color?: "orange" | "green" | "blue" | "red" | "purple";
  trend?: { value: number; label: string };
}

const colors = {
  orange: "from-orange-500 to-orange-600 text-orange-50",
  green:  "from-green-500 to-green-600 text-green-50",
  blue:   "from-blue-500 to-blue-600 text-blue-50",
  red:    "from-red-500 to-red-600 text-red-50",
  purple: "from-purple-500 to-purple-600 text-purple-50"
};

export function StatCard({ title, value, subtitle, icon, color = "orange", trend }: StatCardProps) {
  return (
    <div class={`bg-gradient-to-br ${colors[color]} rounded-xl p-3 shadow-sm`}>
      <div class="flex items-start justify-between mb-1.5">
        <p class="text-[10px] font-semibold uppercase tracking-wide opacity-80">{title}</p>
        {icon && <div class="opacity-80">{icon}</div>}
      </div>
      <p class="text-lg font-black">{value}</p>
      {subtitle && <p class="text-[10px] opacity-70 mt-0.5">{subtitle}</p>}
      {trend && (
        <div class={`flex items-center gap-1 text-xs mt-1.5 ${trend.value >= 0 ? "opacity-80" : "opacity-80"}`}>
          <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
          <span class="opacity-70">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
