"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number | number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

function SliderImpl(
  { className, value, onValueChange, min = 0, max = 100, step = 1, disabled = false, ...props }: SliderProps,
  ref: React.Ref<HTMLDivElement>
) {
  const [localValue, setLocalValue] = React.useState<number[]>(() => {
    if (Array.isArray(value)) {
      return value.length >= 2 ? value : [value[0] || min, max];
    }
    return [typeof value === 'number' ? value : min, max];
  });

  React.useEffect(() => {
    if (Array.isArray(value)) {
      setLocalValue(value.length >= 2 ? value : [value[0] || min, max]);
    } else if (typeof value === 'number') {
      setLocalValue([value, max]);
    }
  }, [value, min, max]);

  const handleChange = React.useCallback((newValue: number[]) => {
    if (disabled) return;
    
    // Ensure min <= max
    const sortedValue = [Math.min(newValue[0], newValue[1]), Math.max(newValue[0], newValue[1])];
    setLocalValue(sortedValue);
    onValueChange?.(sortedValue);
  }, [onValueChange, disabled]);

  const handleMouseDown = React.useCallback((thumbIndex: number) => {
    if (disabled) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const slider = (e.currentTarget as HTMLElement)?.querySelector('.slider-track');
      if (!slider) return;
      
      const rect = slider.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newValue = min + percentage * (max - min);
      const steppedValue = Math.round(newValue / step) * step;
      
      const newValues = [...localValue];
      newValues[thumbIndex] = Math.max(min, Math.min(max, steppedValue));
      handleChange(newValues);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [localValue, min, max, step, handleChange, disabled]);

  const getThumbPosition = React.useCallback((value: number) => {
    return ((value - min) / (max - min)) * 100;
  }, [min, max]);

  const thumbPosition1 = getThumbPosition(localValue[0]);
  const thumbPosition2 = getThumbPosition(localValue[1]);
  const fillStart = Math.min(thumbPosition1, thumbPosition2);
  const fillWidth = Math.abs(thumbPosition2 - thumbPosition1);

  return (
    <div 
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {/* Track */}
      <div className="slider-track relative h-2 w-full rounded-full bg-gray-200">
        {/* Fill */}
        <div
          className="absolute h-2 rounded-full bg-green-500"
          style={{
            left: `${fillStart}%`,
            width: `${fillWidth}%`
          }}
        />
        
        {/* Thumb 1 */}
        <div
          className={cn(
            "absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full border-2 border-white bg-green-500 shadow-sm transition-colors",
            !disabled && "cursor-pointer hover:bg-green-600",
            disabled && "cursor-not-allowed"
          )}
          style={{ left: `${thumbPosition1}%` }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleMouseDown(0);
          }}
        />
        
        {/* Thumb 2 */}
        <div
          className={cn(
            "absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full border-2 border-white bg-green-500 shadow-sm transition-colors",
            !disabled && "cursor-pointer hover:bg-green-600",
            disabled && "cursor-not-allowed"
          )}
          style={{ left: `${thumbPosition2}%` }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleMouseDown(1);
          }}
        />
      </div>
    </div>
  )
}

const Slider = React.forwardRef(SliderImpl)
Slider.displayName = "Slider"

export { Slider }
