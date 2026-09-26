import { JSX } from "preact";
import { forwardRef } from "preact/compat";

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: JSX.Element;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, class: cls, id, ...props }, ref) => (
    <div class="w-full">
      {label && <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for={id}>{label}</label>}
      <div class="relative">
        {icon && <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        <input
          ref={ref} id={id}
          class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm ${icon ? "pl-9" : ""} ${error ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-600"} ${cls || ""}`}
          {...props}
        />
      </div>
      {error && <p class="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
);

interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, class: cls, id, ...props }, ref) => (
    <div class="w-full">
      {label && <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for={id}>{label}</label>}
      <select
        ref={ref} id={id}
        class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm ${error ? "border-red-400" : "border-gray-200 dark:border-gray-600"} ${cls || ""}`}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p class="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
