import { h } from 'preact';

export interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  color?: string;
}

export function StatCard({ icon, label, value, change, changeType = 'neutral', color = 'orange' }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center gap-3">
        <div class={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colorClasses[color] || colorClasses.orange}`}>
          {icon}
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-500">{label}</p>
          <p class="text-2xl font-bold text-gray-800">{value}</p>
        </div>
      </div>
      {change && (
        <p class={`text-xs mt-2 ${changeType === 'up' ? 'text-green-600' : changeType === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
          {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : '→'} {change}
        </p>
      )}
    </div>
  );
}
