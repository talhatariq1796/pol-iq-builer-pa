"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronRightIcon, DotFilledIcon } from "@radix-ui/react-icons"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

type DropdownMenuSubTriggerProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}

function DropdownMenuSubTriggerImpl({ className, inset, children, ...props }: DropdownMenuSubTriggerProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

const DropdownMenuSubTrigger = React.forwardRef(DropdownMenuSubTriggerImpl)
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

type DropdownMenuSubContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>

function DropdownMenuSubContentImpl({ className, ...props }: DropdownMenuSubContentProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubContent>>) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )
}

const DropdownMenuSubContent = React.forwardRef(DropdownMenuSubContentImpl)
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

type DropdownMenuContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>

function DropdownMenuContentImpl({ className, sideOffset = 4, ...props }: DropdownMenuContentProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Content>>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

const DropdownMenuContent = React.forwardRef(DropdownMenuContentImpl)
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

type DropdownMenuItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
}

function DropdownMenuItemImpl({ className, inset, ...props }: DropdownMenuItemProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Item>>) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

const DropdownMenuItem = React.forwardRef(DropdownMenuItemImpl)
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

type DropdownMenuCheckboxItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>

function DropdownMenuCheckboxItemImpl({ className, children, checked, ...props }: DropdownMenuCheckboxItemProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

const DropdownMenuCheckboxItem = React.forwardRef(DropdownMenuCheckboxItemImpl)
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

type DropdownMenuRadioItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>

function DropdownMenuRadioItemImpl({ className, children, ...props }: DropdownMenuRadioItemProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <DotFilledIcon className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

const DropdownMenuRadioItem = React.forwardRef(DropdownMenuRadioItemImpl)
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}

function DropdownMenuLabelImpl({ className, inset, ...props }: DropdownMenuLabelProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Label>>) {
  return <DropdownMenuPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-xs font-semibold", inset && "pl-8", className)} {...props} />
}

const DropdownMenuLabel = React.forwardRef(DropdownMenuLabelImpl)
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>

function DropdownMenuSeparatorImpl({ className, ...props }: DropdownMenuSeparatorProps, ref: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Separator>>) {
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
}

const DropdownMenuSeparator = React.forwardRef(DropdownMenuSeparatorImpl)
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
