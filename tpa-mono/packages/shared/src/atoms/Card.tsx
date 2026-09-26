import { h, ComponentChildren } from 'preact';

export interface CardProps {
  children: ComponentChildren;
  title?: string;
  subtitle?: string;
  action?: ComponentChildren;
  noPadding?: boolean;
  className?: string;
}

export function Card({ children, title, subtitle, action, noPadding = false, className = '' }: CardProps) {
  return (
    <div class={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {(title || action) && (
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            {title && <h3 class="text-base font-semibold text-gray-800">{title}</h3>}
            {subtitle && <p class="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div class={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}
