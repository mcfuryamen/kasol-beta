import { h } from 'preact';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div class={`${sizeClasses[size]} ${className}`}>
      <div class="animate-spin rounded-full border-2 border-gray-200 border-t-orange-500 w-full h-full" />
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <Spinner size="lg" />
        <p class="mt-4 text-gray-500">Memuat...</p>
      </div>
    </div>
  );
}
