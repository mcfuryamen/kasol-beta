import { h, ComponentChildren } from 'preact';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ComponentChildren;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'Belum ada data',
  onRowClick,
  rowKey,
}: TableProps<T>) {
  const alignClass = (align?: string) =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200">
            {columns.map(col => (
              <th
                key={col.key}
                class={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${alignClass(col.align)}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length} class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} class="px-4 py-8 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row) : i}
                class={`border-b border-gray-50 hover:bg-orange-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td key={col.key} class={`px-4 py-3 text-sm ${alignClass(col.align)}`}>
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
