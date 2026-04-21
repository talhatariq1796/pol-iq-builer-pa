// components/ui/alert.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const alertVariants = cva(
  "relative w-full rounded-lg theme-border-primary px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:theme-text-primary [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "theme-bg-tertiary theme-text-primary",
        destructive:
          "theme-border-destructive theme-text-destructive [&>svg]:theme-text-destructive theme-bg-destructive-subtle",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef(({ className = "", variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>, ref: React.Ref<HTMLDivElement>) => (
  <div
    ref={ref}
    role="alert"
    className={alertVariants({ variant, className })}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef(({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>, ref: React.Ref<HTMLParagraphElement>) => (
  <div
    ref={ref}
    className={`text-sm [&_p]:leading-relaxed ${className}`}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }