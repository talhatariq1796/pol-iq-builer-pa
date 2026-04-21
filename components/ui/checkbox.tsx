"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function CheckboxImpl(
  { className, checked, onCheckedChange, ...props }: CheckboxProps,
  ref: React.Ref<HTMLInputElement>
) {
  return (
    <label className="inline-flex items-center">
      <input
        type="checkbox"
        className="sr-only"
        ref={ref}
        checked={checked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.((e.target as HTMLInputElement).checked)}
        {...props}
      />
      <div
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked && "bg-primary text-primary-foreground",
          className
        )}
      >
        {checked && <Check className="h-4 w-4 text-current" />}
      </div>
    </label>
  )
}

const Checkbox = React.forwardRef(CheckboxImpl)
Checkbox.displayName = "Checkbox"

export { Checkbox }
