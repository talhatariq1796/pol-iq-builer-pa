import * as React from "react"
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

type DialogOverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>

function DialogOverlayImpl({ className, ...props }: DialogOverlayProps, ref: React.Ref<React.ElementRef<typeof DialogPrimitive.Overlay>>) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 theme-dialog-overlay",
        className
      )}
      {...props}
    />
  )
}

const DialogOverlay = React.forwardRef(DialogOverlayImpl)
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }

function DialogContentImpl({ className, children, hideClose = false, ...props }: DialogContentProps, ref: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg theme-dialog-content",
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 disabled:pointer-events-none theme-dialog-close">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

const DialogContent = React.forwardRef(DialogContentImpl)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

type DialogTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>

function DialogTitleImpl({ className, ...props }: DialogTitleProps, ref: React.Ref<React.ElementRef<typeof DialogPrimitive.Title>>) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-xs font-semibold leading-none tracking-tight theme-dialog-title", className)}
      {...props}
    />
  )
}

const DialogTitle = React.forwardRef(DialogTitleImpl)
DialogTitle.displayName = DialogPrimitive.Title.displayName

type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>

function DialogDescriptionImpl({ className, ...props }: DialogDescriptionProps, ref: React.Ref<React.ElementRef<typeof DialogPrimitive.Description>>) {
  return <DialogPrimitive.Description ref={ref} className={cn("text-xs theme-dialog-description", className)} {...props} />
}

const DialogDescription = React.forwardRef(DialogDescriptionImpl)
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}