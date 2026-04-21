"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal"
}

const ScrollArea = React.forwardRef(
  ({ className, children, ...props }: ScrollAreaProps, ref: React.Ref<HTMLDivElement>) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-auto",
        // Custom scrollbar styling with MPIQ colors
        "[&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded",
        "[&::-webkit-scrollbar-thumb]:bg-[#33a852] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-[#2d8f47]",
        // Firefox scrollbar
        "scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-[#33a852]",
        className
      )}
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#33a852 #f3f4f6",
        ...props.style,
      }}
      {...props}
    >
      <div className="h-full w-full rounded-[inherit]">
        {children}
      </div>
    </div>
  )
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
