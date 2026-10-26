interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  src?: string;
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base"
};

const colors = ["bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-red-500", "bg-yellow-500"];

export function Avatar({ name, size = "md", src }: AvatarProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const color = colors[name.charCodeAt(0) % colors.length];
  if (src) return <img src={src} alt={name} class={`${sizes[size]} rounded-full object-cover`} />;
  return (
    <div class={`${sizes[size]} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}
