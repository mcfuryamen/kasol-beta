interface ShortcutBadgeProps {
  label: string;
  class?: string;
}

export function ShortcutBadge({ label, class: cls }: ShortcutBadgeProps) {
  return (
    <span class={`inline-flex items-center px-1 py-0 rounded text-[9px] font-mono font-bold border border-current opacity-50 ${cls || ""}`}>
      {label}
    </span>
  );
}
