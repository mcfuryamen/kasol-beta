import { JSX } from "preact";
import { useState } from "preact/hooks";

interface NumpadKeyProps {
  label: string | JSX.Element;
  sublabel?: string;
  onClick: () => void;
  variant?: "default" | "action" | "danger" | "pay" | "mode";
  disabled?: boolean;
  class?: string;
}

const variants = {
  default: "bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600",
  action:  "bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500",
  danger:  "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700",
  pay:     "bg-green-500 hover:bg-green-600 text-white shadow-lg border border-green-600",
  mode:    "bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700"
};

export function NumpadKey({ label, sublabel, onClick, variant = "default", disabled, class: cls }: NumpadKeyProps) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      class={`flex flex-col items-center justify-center rounded-xl font-bold transition-all duration-100 select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500
        ${pressed ? "scale-95 brightness-90" : ""}
        ${variants[variant]}
        ${cls || ""}`}
    >
      <span class="leading-tight">{label}</span>
      {sublabel && <span class="text-[10px] opacity-60 mt-0.5">{sublabel}</span>}
    </button>
  );
}
