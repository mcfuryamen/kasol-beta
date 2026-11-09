import { JSX } from "preact";
import { forwardRef } from "preact/compat";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "success";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: JSX.Element;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   "bg-primary-500 hover:bg-primary-600 text-white shadow-sm",
  secondary: "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200",
  danger:    "bg-red-500 hover:bg-red-600 text-white shadow-sm",
  ghost:     "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300",
  outline:   "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200",
  success:   "bg-green-500 hover:bg-green-600 text-white shadow-sm"
};
const sizes: Record<Size, string> = {
  xs: "px-2 py-1 text-xs rounded",
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, fullWidth, children, class: cls, ...props }, ref) => (
    <button
      ref={ref}
      class={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${cls || ""}`}
      {...props}
    >
      {loading ? <span class="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : icon}
      {children}
    </button>
  )
);
