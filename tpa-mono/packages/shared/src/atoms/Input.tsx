import { h, JSX } from 'preact';
import { forwardRef } from 'preact/compat';

export interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '_');

  return (
    <div class="space-y-1">
      {label && (
        <label htmlFor={inputId} class="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div class="relative">
        {leftIcon && (
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{leftIcon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          class={`w-full rounded-lg border px-3 py-2 text-sm transition-colors
            focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
            disabled:bg-gray-50 disabled:text-gray-400
            ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'}
            ${leftIcon ? 'pl-9' : ''}
            ${className}`}
          {...props}
        />
      </div>
      {error && <p class="text-xs text-red-500">{error}</p>}
      {hint && !error && <p class="text-xs text-gray-400">{hint}</p>}
    </div>
  );
});
