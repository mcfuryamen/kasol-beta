import { h, JSX } from 'preact';

export interface TextareaProps extends JSX.HTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div class="space-y-1">
      {label && (
        <label class="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        class={`w-full rounded-lg border px-3 py-2 text-sm transition-colors resize-y min-h-[80px]
          focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
          ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
        {...props}
      />
      {error && <p class="text-xs text-red-500">{error}</p>}
    </div>
  );
}
