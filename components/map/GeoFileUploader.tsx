/**
 * GeoFileUploader Component
 *
 * Allows users to upload geographic data files for display as temporary overlay layers.
 * Features:
 * - Drag & drop zone
 * - File input button
 * - File type validation (.geojson, .json, .csv, .zip)
 * - Size validation (max 10MB)
 * - GeoJSON, CSV, and Shapefile parsing and validation
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  parseGeoJSON,
  parseCSV,
  parseShapefile,
  validateFileSize,
  validateFeatureCount,
  getFileType,
} from '@/lib/map/fileParser';

export interface UploadedLayer {
  id: string;
  name: string;
  geojson: GeoJSON.FeatureCollection;
  visible: boolean;
}

interface GeoFileUploaderProps {
  onLayerAdded: (layer: UploadedLayer) => void;
  onError: (error: string) => void;
  maxFileSizeMB?: number;
}

const GeoFileUploader: React.FC<GeoFileUploaderProps> = ({
  onLayerAdded,
  onError,
  maxFileSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate and parse geographic data file
  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);

      try {
        // Determine file type
        const fileType = getFileType(file.name);

        if (fileType === 'unknown') {
          onError('Unsupported file type. Please upload GeoJSON (.geojson, .json), CSV (.csv), or Shapefile (.zip)');
          return;
        }

        // Validate file size
        try {
          validateFileSize(file, maxFileSizeMB);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'File too large');
          return;
        }

        // Parse file based on type
        let featureCollection: GeoJSON.FeatureCollection;

        try {
          switch (fileType) {
            case 'geojson':
              featureCollection = await parseGeoJSON(file);
              break;

            case 'csv':
              featureCollection = await parseCSV(file);
              break;

            case 'shapefile':
              featureCollection = await parseShapefile(file);
              break;

            default:
              throw new Error('Unsupported file type');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
          onError(errorMessage);
          return;
        }

        // Validate feature count
        try {
          validateFeatureCount(featureCollection, 50000);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Too many features');
          return;
        }

        // Warn for large files
        if (featureCollection.features.length > 1000) {
          console.warn(
            `[GeoFileUploader] Large file uploaded: ${featureCollection.features.length} features`
          );
        }

        // Create layer
        const layer: UploadedLayer = {
          id: `uploaded-${Date.now()}`,
          name: file.name.replace(/\.(geojson|json|csv|zip)$/i, ''),
          geojson: featureCollection,
          visible: true,
        };

        onLayerAdded(layer);
      } catch (error) {
        console.error('[GeoFileUploader] Error processing file:', error);
        onError('Failed to process file. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    },
    [maxFileSizeMB, onLayerAdded, onError]
  );

  // Handle file selection via input
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.csv,.zip"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drag and drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-4 transition-colors
          ${isDragging
            ? 'border-[#33a852] bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onClick={!isProcessing ? handleButtonClick : undefined}
      >
        <div className="flex flex-col items-center justify-center text-center">
          {/* Upload icon */}
          <svg
            className={`w-10 h-10 mb-3 ${
              isDragging ? 'text-[#33a852]' : 'text-gray-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {isProcessing ? (
            <div className="text-sm text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33a852] mx-auto mb-2" />
              Processing file...
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-medium text-[#33a852]">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                GeoJSON, CSV, or Shapefile (ZIP), max {maxFileSizeMB}MB
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeoFileUploader;
