import { useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Select } from "./select"
import { EmptyState } from "./empty-state"

/* Sortable/paginated data primitive per DESIGN_SYSTEM.md §4.7 ("@tanstack/react-table
   wrapped in shadcn DataTable pattern"). Distinct from components/ui/data-table.jsx,
   which is an unrelated CSS-grid list-row primitive already used across the app. */
function SortIcon({ direction }) {
  if (direction === "asc") return <ArrowUp className="h-3.5 w-3.5" />
  if (direction === "desc") return <ArrowDown className="h-3.5 w-3.5" />
  return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
}

export function SortableTable({
  columns,
  data,
  empty_message = "No records found.",
  page_size = 10,
  page_size_options = [10, 25, 50],
  className,
}) {
  const [sorting, set_sorting] = useState([])
  const [pagination, set_pagination] = useState({ pageIndex: 0, pageSize: page_size })

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: set_sorting,
    onPaginationChange: set_pagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const rows = table.getRowModel().rows

  if (data.length === 0) {
    return <EmptyState>{empty_message}</EmptyState>
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((header_group) => (
              <tr key={header_group.id}>
                {header_group.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      className="border-b border-border px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            className="h-8 w-auto"
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {page_size_options.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
