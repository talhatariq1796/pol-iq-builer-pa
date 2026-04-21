"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple"
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
}

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function ToggleGroupImpl(
  { className, type = "single", value, onValueChange, children, ...props }: ToggleGroupProps,
  ref: React.Ref<HTMLDivElement>
) {
  const handleItemClick = (itemValue: string) => {
    if (type === "single") {
      onValueChange?.(itemValue)
    } else {
      const values = (value as string[]) || []
      onValueChange?.(
        values.includes(itemValue)
          ? values.filter((v) => v !== itemValue)
          : [...values, itemValue]
      )
    }
  }

  return (
    <div ref={ref} className={cn("inline-flex bg-white rounded-lg border shadow-sm", className)} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            onClick: () => handleItemClick(child.props.value),
            "data-state":
              type === "single"
                ? value === child.props.value
                  ? "on"
                  : "off"
                : (value as string[])?.includes(child.props.value)
                ? "on"
                : "off",
          } as React.HTMLAttributes<HTMLButtonElement>)
        }
        return child
      })}
    </div>
  )
}

const ToggleGroup = React.forwardRef(ToggleGroupImpl)
ToggleGroup.displayName = "ToggleGroup"

function ToggleGroupItemImpl({ className, children, ...props }: ToggleGroupItemProps, ref: React.Ref<HTMLButtonElement>) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const ToggleGroupItem = React.forwardRef(ToggleGroupItemImpl)
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }