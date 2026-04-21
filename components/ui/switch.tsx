"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function SwitchImpl(
  { className, checked, onCheckedChange, ...props }: SwitchProps,
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
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-[#33a852]" : "bg-gray-200",
          className
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </label>
  )
}

const Switch = React.forwardRef(SwitchImpl)
Switch.displayName = "Switch"

export { Switch }
