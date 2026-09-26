import { h, ComponentChildren } from 'preact';
import { Table, Column } from '../atoms/Table';
import { SearchBar } from './SearchBar';
import { Button } from '../atoms/Button';

export interface DataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchValue: string;
  onSearch: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
  filterSlot?: ComponentChildren;
  actionSlot?: ComponentChildren;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  isLoading,
  searchValue,
  onSearch,
  onAdd,
  addLabel = 'Tambah',
  onRowClick,
  rowKey,
  filterSlot,
  actionSlot,
  pagination,
}: DataTableProps<T>) {
  return (
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="px-5 py-4 border-b border-gray-100">
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h3 class="text-base font-semibold text-gray-800">{title}</h3>
          <div class="flex items-center gap-3 flex-1 sm:flex-initial">
            <SearchBar value={searchValue} onChange={onSearch} className="w-full sm:w-64" />
            {actionSlot}
            {onAdd && <Button onClick={onAdd} leftIcon="+" size="sm">{addLabel}</Button>}
          </div>
        </div>
        {filterSlot && <div class="mt-3 flex gap-2 flex-wrap">{filterSlot}</div>}
      </div>

      <Table columns={columns} data={data} isLoading={isLoading} onRowClick={onRowClick} rowKey={rowKey} />

      {pagination && pagination.totalPages > 1 && (
        <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p class="text-sm text-gray-500">
            Halaman {pagination.page} dari {pagination.totalPages}
          </p>
          <div class="flex gap-2">
            <Button
              variant="ghost" size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              ← Sebelumnya
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Selanjutnya →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
