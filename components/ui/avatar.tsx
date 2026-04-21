"use client"

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

type AvatarRootProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>

function AvatarImpl({ className, ...props }: AvatarRootProps, ref: React.Ref<React.ElementRef<typeof AvatarPrimitive.Root>>) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}

const Avatar = React.forwardRef(AvatarImpl)
Avatar.displayName = AvatarPrimitive.Root.displayName

type AvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>

function AvatarImageImpl({ className, ...props }: AvatarImageProps, ref: React.Ref<React.ElementRef<typeof AvatarPrimitive.Image>>) {
  return <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
}

const AvatarImage = React.forwardRef(AvatarImageImpl)
AvatarImage.displayName = AvatarPrimitive.Image.displayName

type AvatarFallbackProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>

function AvatarFallbackImpl({ className, ...props }: AvatarFallbackProps, ref: React.Ref<React.ElementRef<typeof AvatarPrimitive.Fallback>>) {
  return (
    <AvatarPrimitive.Fallback ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props} />
  )
}

const AvatarFallback = React.forwardRef(AvatarFallbackImpl)
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }