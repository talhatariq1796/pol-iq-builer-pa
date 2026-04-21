"use client"

import React, { forwardRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string | string[];
  type?: 'single' | 'multiple';
  collapsible?: boolean;
}

const Accordion = ({ children, defaultValue, type, collapsible, ...props }: AccordionProps) => {
  // Support both single string and array of strings for defaultValue
  const initialValue = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue;
  const [openItem, setOpenItem] = useState<string | null>(initialValue ?? null);

  const items = React.Children.map(children, (child: any) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        isOpen: child.props.value === openItem,
        onToggle: () => {
          console.log('Toggling:', child.props.value, 'Current:', openItem); // Debug
          setOpenItem(openItem === child.props.value ? null : child.props.value);
        }
      });
    }
    return child;
  });

  return <div {...props}>{items}</div>;
};

const AccordionItem = forwardRef((props: React.HTMLAttributes<HTMLDivElement> & { value: string; isOpen?: boolean; onToggle?: () => void }, ref: React.Ref<HTMLDivElement>) => {
  const { className, children, isOpen, onToggle, value, ...otherProps } = props;
  const childrenArray = React.Children.toArray(children);
  const trigger = childrenArray[0];
  const content = childrenArray[1];

  return (
          <div
        ref={ref}
        className={`border-b border-gray-200 ${className}`}
        {...otherProps}
      >
      {React.isValidElement(trigger) && 
        React.cloneElement(trigger as React.ReactElement<any>, { 
          isOpen, 
          onClick: onToggle,
          className: "px-4 py-2 w-full flex justify-between items-center"
        })}
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isOpen ? "max-h-[800px]" : "max-h-0"
      )}>
        {content}
      </div>
    </div>
  );
});
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = forwardRef((props: React.ButtonHTMLAttributes<HTMLButtonElement> & { isOpen?: boolean }, ref: React.Ref<HTMLButtonElement>) => {
  const { className, children, isOpen, ...otherProps } = props;
  return (
  <button
    ref={ref}
    data-state={isOpen ? "open" : "closed"}
    className={cn(
      "flex w-full items-center justify-between py-2 text-xs font-medium transition-all hover:underline",
      className
    )}
    {...otherProps}
  >
    {children}
    <ChevronDown className={cn(
      "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
      isOpen && "rotate-180"
    )} />
  </button>
  );
});
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = forwardRef((props: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) => {
  const { className, children, ...otherProps } = props;
  return (
  <div
    ref={ref}
    className={cn("text-sm", className)}
    {...otherProps}
  >
    <div className="pb-4 pt-0 px-4">{children}</div>
  </div>
  );
});
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
