// This file provides TypeScript declarations for custom module paths

// Configuration modules
declare module '@/config/color-config' {
  export const DEFAULT_COLORS: Record<string, any>;
  export function getColor(path: string, fallback?: string): string;
  export default DEFAULT_COLORS;
}

// UI components
declare module '@/components/ui/avatar' {
  export const Avatar: React.ForwardRefExoticComponent<any>;
  export const AvatarImage: React.ForwardRefExoticComponent<any>;
  export const AvatarFallback: React.ForwardRefExoticComponent<any>;
}

declare module '@/components/ui/separator' {
  export const Separator: React.ForwardRefExoticComponent<any>;
}

declare module '@/components/ui/resizable' {
  export const ResizablePanelGroup: React.FC<any>;
  export const ResizablePanel: React.FC<any>;
  export const ResizableHandle: React.FC<any>;
}

// Utility components
declare module '@/components/common/location-search' {
  export interface LocationResult {
    address: string;
    longitude: number;
    latitude: number;
    type: 'address' | 'city' | 'region' | 'country';
    bbox?: [number, number, number, number];
  }

  export interface LocationSearchProps {
    onLocationSelected: (location: LocationResult) => void;
    placeholder?: string;
    className?: string;
  }

  export function LocationSearch(props: LocationSearchProps): JSX.Element;
} 