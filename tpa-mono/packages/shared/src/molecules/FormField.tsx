import { h, ComponentChildren } from 'preact';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ComponentChildren;
  className?: string;
}

export function FormField({ label, error, required, children, className = '' }: FormFieldProps) {
  return (
    <div class={`space-y-1 ${className}`}>
      <label class="block text-sm font-medium text-gray-700">
        {label}
        {required && <span class="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p class="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
