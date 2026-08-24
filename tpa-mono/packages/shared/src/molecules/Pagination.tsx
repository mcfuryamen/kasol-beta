import { h } from 'preact';
import { Button } from '../atoms/Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i);
  }

  return (
    <div class="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>←</Button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          class={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
            p === page ? 'bg-orange-500 text-white' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          {p}
        </button>
      ))}
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>→</Button>
    </div>
  );
}
