'use client'

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

type ToastViewportProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>

function ToastViewportImpl({ className, ...props }: ToastViewportProps, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Viewport>>) {
  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
}

const ToastViewport = React.forwardRef(ToastViewportImpl)
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-white text-gray-900",
        destructive:
          "destructive group border-destructive bg-red-600 text-white",
        success: "border-green-500/50 bg-green-50 text-green-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type ToastPropsInner = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>

function ToastImpl({ className, variant, ...props }: ToastPropsInner, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Root>>) {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
}

const Toast = React.forwardRef(ToastImpl)
Toast.displayName = ToastPrimitives.Root.displayName

type ToastActionProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>

function ToastActionImpl({ className, ...props }: ToastActionProps, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Action>>) {
  return (
    <ToastPrimitives.Action
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-xs font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

const ToastAction = React.forwardRef(ToastActionImpl)
ToastAction.displayName = ToastPrimitives.Action.displayName

type ToastCloseProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>

function ToastCloseImpl({ className, ...props }: ToastCloseProps, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Close>>) {
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitives.Close>
  )
}

const ToastClose = React.forwardRef(ToastCloseImpl)
ToastClose.displayName = ToastPrimitives.Close.displayName

type ToastTitleProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>

function ToastTitleImpl({ className, ...props }: ToastTitleProps, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Title>>) {
  return <ToastPrimitives.Title ref={ref} className={cn("text-xs font-semibold", className)} {...props} />
}

const ToastTitle = React.forwardRef(ToastTitleImpl)
ToastTitle.displayName = ToastPrimitives.Title.displayName

type ToastDescriptionProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>

function ToastDescriptionImpl({ className, ...props }: ToastDescriptionProps, ref: React.Ref<React.ElementRef<typeof ToastPrimitives.Description>>) {
  return <ToastPrimitives.Description ref={ref} className={cn("text-xs opacity-90", className)} {...props} />
}

const ToastDescription = React.forwardRef(ToastDescriptionImpl)
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} 