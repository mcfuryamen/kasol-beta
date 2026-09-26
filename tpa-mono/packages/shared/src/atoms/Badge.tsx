import { h } from 'preact';

export interface BadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color = 'text-gray-600 bg-gray-100', className = '' }: BadgeProps) {
  return (
    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  );
}
