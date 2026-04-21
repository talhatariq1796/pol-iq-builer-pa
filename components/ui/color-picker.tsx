import React from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  return (
    <input
      type="color"
      value={color}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
    />
  );
}; 