import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { cn } from "@/lib/utils"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = React.forwardRef(({ className, ...props }: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>, ref: React.Ref<React.ElementRef<typeof CollapsiblePrimitive.Trigger>>) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between p-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
      className
    )}
    {...props}
  />
))
CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName

const CollapsibleContent = React.forwardRef(({ className, ...props }: React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>, ref: React.Ref<React.ElementRef<typeof CollapsiblePrimitive.Content>>) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    {...props}
  />
))
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName

export { Collapsible, CollapsibleTrigger, CollapsibleContent }