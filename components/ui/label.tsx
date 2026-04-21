"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>

function LabelImpl({ className, ...props }: LabelProps, ref: React.Ref<
  React.ElementRef<typeof LabelPrimitive.Root>
>) {
  return (
    <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
  )
}

const Label = React.forwardRef(LabelImpl)
Label.displayName = LabelPrimitive.Root.displayName

export { Label }