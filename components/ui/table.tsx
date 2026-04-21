import * as React from "react"

import { cn } from "@/lib/utils"

function TableImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableElement>,
  ref: React.Ref<HTMLTableElement>
) {
  return (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
}

const Table = React.forwardRef(TableImpl)
Table.displayName = "Table"

function TableHeaderImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>,
  ref: React.Ref<HTMLTableSectionElement>
) {
  return <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
}

const TableHeader = React.forwardRef(TableHeaderImpl)
TableHeader.displayName = "TableHeader"

function TableBodyImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>,
  ref: React.Ref<HTMLTableSectionElement>
) {
  return (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
}

const TableBody = React.forwardRef(TableBodyImpl)
TableBody.displayName = "TableBody"

function TableFooterImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>,
  ref: React.Ref<HTMLTableSectionElement>
) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

const TableFooter = React.forwardRef(TableFooterImpl)
TableFooter.displayName = "TableFooter"

function TableRowImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableRowElement>,
  ref: React.Ref<HTMLTableRowElement>
) {
  return (
    <tr ref={ref} className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />
  )
}

const TableRow = React.forwardRef(TableRowImpl)
TableRow.displayName = "TableRow"

function TableHeadImpl(
  { className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>,
  ref: React.Ref<HTMLTableCellElement>
) {
  return (
    <th ref={ref} className={cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
  )
}

const TableHead = React.forwardRef(TableHeadImpl)
TableHead.displayName = "TableHead"

function TableCellImpl(
  { className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>,
  ref: React.Ref<HTMLTableCellElement>
) {
  return (
    <td ref={ref} className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props} />
  )
}

const TableCell = React.forwardRef(TableCellImpl)
TableCell.displayName = "TableCell"

function TableCaptionImpl(
  { className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>,
  ref: React.Ref<HTMLTableCaptionElement>
) {
  return <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
}

const TableCaption = React.forwardRef(TableCaptionImpl)
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
