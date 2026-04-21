import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
  label?: string;
  fullWidth?: boolean;
}

function InputImpl(
  { className, type, error, helperText, label, fullWidth, ...props }: InputProps,
  ref: React.Ref<HTMLInputElement>
) {
  return (
    <div className={cn("flex flex-col gap-1", fullWidth && "w-full")}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
      {helperText && (
        <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {helperText}
        </p>
      )}
    </div>
  )
}

const Input = React.forwardRef(InputImpl)
Input.displayName = "Input"

export { Input }
