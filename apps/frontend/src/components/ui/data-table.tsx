'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Card } from './index';
import { Spinner } from './index';
import { EmptyState } from './index';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <Card className="flex items-center justify-center p-12">
        <Spinner className="h-6 w-6" />
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card className="p-12">
        <EmptyState title={emptyMessage} />
      </Card>
    );
  }

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <>
      {/* Desktop table */}
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden">
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-col gap-2">
                {row.getVisibleCells().map((cell) => {
                  const header = headerGroups[0]?.headers.find(
                    (h) => h.id === cell.column.id,
                  );
                  return (
                    <div
                      key={cell.id}
                      className="flex items-start justify-between gap-4"
                    >
                      <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        {header
                          ? flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          : cell.column.id}
                      </span>
                      <span className="text-right text-sm text-gray-700 dark:text-gray-300">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
