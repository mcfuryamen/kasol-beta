import { h, JSX } from 'preact';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<JSX.HTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function Select({ label, error, options, placeholder, onChange, className = '', value, ...props }: SelectProps) {
  return (
    <div class="space-y-1">
      {label && (
        <label class="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.((e.target as HTMLSelectElement).value)}
        class={`w-full rounded-lg border px-3 py-2 text-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
          ${error ? 'border-red-400' : 'border-gray-300'}
          ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p class="text-xs text-red-500">{error}</p>}
    </div>
  );
}
