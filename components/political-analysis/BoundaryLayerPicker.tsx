/**
 * BoundaryLayerPicker Component
 *
 * Dropdown selector for choosing boundary layer types
 * (precincts, ZIP codes, block groups, legislative districts, etc.)
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Grid3X3,
  Building2,
  Landmark,
  Vote,
  GraduationCap,
  Trees,
  Hexagon,
} from 'lucide-react';
import type { BoundaryLayerType } from '@/types/political';
import {
  BOUNDARY_LAYERS,
  AVAILABLE_BOUNDARY_TYPES,
} from '@/lib/political/paBoundaryLayers';

export { BOUNDARY_LAYERS, AVAILABLE_BOUNDARY_TYPES };

// Icon mapping for each boundary type
const BOUNDARY_ICONS: Record<BoundaryLayerType, React.ReactNode> = {
  'precinct': <Vote className="h-4 w-4" />,
  h3: <Hexagon className="h-4 w-4" />,
  'zip-code': <Mail className="h-4 w-4" />,
  'block-group': <Grid3X3 className="h-4 w-4" />,
  'census-tract': <Grid3X3 className="h-4 w-4" />,
  'state-house': <Landmark className="h-4 w-4" />,
  'state-senate': <Landmark className="h-4 w-4" />,
  'congressional': <Landmark className="h-4 w-4" />,
  'municipality': <Building2 className="h-4 w-4" />,
  'township': <Trees className="h-4 w-4" />,
  'school-district': <GraduationCap className="h-4 w-4" />,
};

interface BoundaryLayerPickerProps {
  value: BoundaryLayerType | null;
  onChange: (type: BoundaryLayerType) => void;
  disabled?: boolean;
  availableLayers?: BoundaryLayerType[];
  showLabel?: boolean;
  placeholder?: string;
}

export function BoundaryLayerPicker({
  value,
  onChange,
  disabled = false,
  availableLayers,
  showLabel = true,
  placeholder = 'Select boundary type...',
}: BoundaryLayerPickerProps) {
  // Filter to available layers if specified, otherwise show layers with data first
  const allLayers = Object.values(BOUNDARY_LAYERS);
  const layers = availableLayers
    ? availableLayers.map(type => BOUNDARY_LAYERS[type])
    : [
        // Show layers with data first
        ...allLayers.filter(l => l.hasData),
        // Then layers without data
        ...allLayers.filter(l => !l.hasData),
      ];

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="text-xs font-medium">Boundary Type</Label>
      )}
      <Select
        value={value || undefined}
        onValueChange={(val) => onChange(val as BoundaryLayerType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {value && (
              <div className="flex items-center gap-2">
                {BOUNDARY_ICONS[value]}
                <span>{BOUNDARY_LAYERS[value].displayName}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {layers.map((layer) => (
            <SelectItem
              key={layer.type}
              value={layer.type}
              disabled={!layer.hasData}
              className={!layer.hasData ? 'opacity-50' : ''}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: layer.hasData ? layer.color : '#9ca3af' }}
                />
                {BOUNDARY_ICONS[layer.type]}
                <div className="flex flex-col">
                  <span className={!layer.hasData ? 'text-muted-foreground' : ''}>
                    {layer.displayName}
                    {!layer.hasData && <span className="text-xs ml-1 text-gray-400">(data needed)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {layer.source}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default BoundaryLayerPicker;
