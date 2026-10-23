import { type ComponentChildren } from "preact";

interface SkeletonProps {
  class?: string;
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

/** Atom: single shimmer placeholder bar */
export function Skeleton({ class: cls = "", width, height, rounded = "md" }: SkeletonProps) {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-lg",
    lg: "rounded-xl",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];
  return (
    <span
      class={`inline-block bg-gray-200 dark:bg-gray-700 shimmer ${roundedClass} ${cls}`}
      style={{ width, height: height || "1em" }}
      aria-hidden="true"
    />
  );
}

const shimmerClass = "bg-gray-200 dark:bg-gray-700 shimmer";

/** Row skeleton for product / customer tables */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div class="flex items-center gap-3 px-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <Skeleton width="2rem" height="2rem" rounded="md" class="flex-shrink-0" />
      <div class="flex-1 space-y-1.5">
        <Skeleton width="60%" height="0.875rem" />
        <Skeleton width="35%" height="0.75rem" rounded="sm" />
      </div>
      <div class="text-right space-y-1.5">
        <Skeleton width="4rem" height="0.875rem" class="ml-auto" />
        <Skeleton width="3rem" height="0.75rem" rounded="sm" class="ml-auto" />
      </div>
    </div>
  );
}

/** Dashboard stat card skeleton */
export function StatCardSkeleton() {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-1.5">
      <div class="flex items-center justify-between">
        <Skeleton width="55%" height="0.75rem" />
        <Skeleton width="2rem" height="2rem" rounded="lg" />
      </div>
      <Skeleton width="40%" height="1.75rem" class="font-bold" />
      <Skeleton width="25%" height="0.75rem" rounded="sm" />
    </div>
  );
}

/** List item skeleton (customers, transactions) */
export function ListItemSkeleton() {
  return (
    <div class="flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <Skeleton width="2.5rem" height="2.5rem" rounded="full" class="flex-shrink-0" />
      <div class="flex-1 space-y-1.5">
        <Skeleton width="50%" height="0.875rem" />
        <Skeleton width="30%" height="0.75rem" rounded="sm" />
      </div>
      <div class="flex gap-1">
        <Skeleton width="3rem" height="1.25rem" rounded="md" />
        <Skeleton width="4rem" height="1.25rem" rounded="md" />
      </div>
    </div>
  );
}

/** Grid card skeleton (products grid view) */
export function GridCardSkeleton() {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-2">
      <Skeleton width="100%" height="5rem" rounded="lg" />
      <Skeleton width="70%" height="0.875rem" />
      <Skeleton width="40%" height="1rem" />
      <Skeleton width="3rem" height="1.25rem" rounded="md" />
    </div>
  );
}
