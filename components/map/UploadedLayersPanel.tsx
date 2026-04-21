/**
 * UploadedLayersPanel Component
 *
 * Displays and manages user-uploaded GeoJSON layers.
 * Features:
 * - Layer name display
 * - Visibility toggle (eye icon)
 * - Remove button (trash icon)
 * - Feature count
 */

import React from 'react';
import type { UploadedLayer } from './GeoFileUploader';

interface UploadedLayersPanelProps {
  layers: UploadedLayer[];
  onToggleVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
}

const UploadedLayersPanel: React.FC<UploadedLayersPanelProps> = ({
  layers,
  onToggleVisibility,
  onRemoveLayer,
}) => {
  if (layers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      {/* Panel header */}
      <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-[#33a852]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Uploaded Layers
      </div>

      {/* Layer list */}
      <div className="space-y-2">
        {layers.map(layer => (
          <div
            key={layer.id}
            className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            {/* Visibility toggle */}
            <button
              onClick={() => onToggleVisibility(layer.id)}
              className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? (
                <svg className="w-4 h-4 text-[#33a852]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              )}
            </button>

            {/* Layer info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate" title={layer.name}>
                {layer.name}
              </div>
              <div className="text-xs text-gray-500">
                {layer.geojson.features.length} feature{layer.geojson.features.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={() => onRemoveLayer(layer.id)}
              className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors group"
              title="Remove layer"
            >
              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadedLayersPanel;
