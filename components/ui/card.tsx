import * as React from "react"

import { cn } from "@/lib/utils"

function CardImpl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) {
  return <div ref={ref} className={cn("theme-card theme-border-primary theme-shadow-primary", className)} {...props} />
}

const Card = React.forwardRef(CardImpl)
Card.displayName = "Card"

function CardHeaderImpl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) {
  return <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
}

const CardHeader = React.forwardRef(CardHeaderImpl)
CardHeader.displayName = "CardHeader"

function CardTitleImpl({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>, ref: React.Ref<HTMLHeadingElement>) {
  return <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight theme-text-primary", className)} {...props} />
}

const CardTitle = React.forwardRef(CardTitleImpl)
CardTitle.displayName = "CardTitle"

function CardDescriptionImpl({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>, ref: React.Ref<HTMLParagraphElement>) {
  return <p ref={ref} className={cn("text-sm theme-text-secondary", className)} {...props} />
}

const CardDescription = React.forwardRef(CardDescriptionImpl)
CardDescription.displayName = "CardDescription"

function CardContentImpl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
}

const CardContent = React.forwardRef(CardContentImpl)
CardContent.displayName = "CardContent"

function CardFooterImpl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) {
  return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
}

const CardFooter = React.forwardRef(CardFooterImpl)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
