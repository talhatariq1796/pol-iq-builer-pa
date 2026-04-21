/* eslint-disable @typescript-eslint/no-explicit-any */
import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { getQuintileColorScheme } from '../../utils/QuintileUtils';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY } from '../../../../utils/renderer-standardization';

/**
 * ClusterRenderer - Advanced cluster visualization for spatial clustering
 * 
 * Features:
 * - Distinct cluster coloring
 * - Cluster centroid markers
 * - Similarity-based styling
 * - Interactive cluster information
 * - Cluster boundary highlighting
 */
export class ClusterRenderer implements VisualizationRendererStrategy {
  
  supportsType(type: string): boolean {
    return type === 'cluster';
  }

  render(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult {
    console.log('🚨🚨🚨 [ClusterRenderer] UPDATED VERSION EXECUTING - SHOULD USE POLYGON FILLS');
  console.log(`[ClusterRenderer] Rendering ${data.records.length} clustered records`);
  console.log(`[ClusterRenderer] 🎯 Data structure:`, {
      isClustered: data.isClustered,
      hasClusterInfo: !!data.clusters,
      clusterCount: data.clusters?.length || 0,
      sampleRecord: data.records[0] ? {
        cluster_id: data.records[0].cluster_id,
        cluster_name: data.records[0].cluster_name,
    hasGeometry: !!(data.records[0] as any).geometry,
    geometryType: (data.records[0] as any).geometry ? (data.records[0] as any).geometry.type : undefined
      } : null
    });
    
    // Extract cluster information
    const clusterInfo = this.extractClusterInformation(data);
    
    // Generate cluster colors
    const clusterColors = this.generateClusterColors(clusterInfo.clusterCount);
    
    // Create cluster-based renderer
    const renderer = this.createClusterRenderer(clusterInfo, clusterColors, config);
    
    // Generate cluster popup template
    const popupTemplate = this.createClusterPopupTemplate(data, config);
    
    // Create cluster legend
  const legend = this.createClusterLegend(clusterInfo, clusterColors) as unknown as import('../../types').LegendConfig;

    return {
      type: 'cluster',
      config: {
        ...config,
        colorScheme: 'categorical',
        clusterInfo
      },
      renderer,
      popupTemplate,
      legend
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private extractClusterInformation(data: ProcessedAnalysisData): ClusterInfo {
    const clusterMap = new Map<number, ClusterDetails>();
    
    console.log(`[ClusterRenderer] 📍 Extracting cluster info from ${data.records.length} records`);
    console.log(`[ClusterRenderer] 📍 Sample record:`, {
      hasClusterId: !!data.records[0]?.cluster_id,
      clusterId: data.records[0]?.cluster_id,
      clusterName: data.records[0]?.cluster_name,
      isClustered: data.records[0]?.properties?.is_clustered
    });
    
    // Analyze each record to build cluster information
    data.records.forEach(record => {
      // Get cluster ID from direct field (clustered ZIP records)
      const clusterId = record.cluster_id; // Cluster ID is stored as direct property
      const clusterName = record.cluster_name || `Cluster ${(clusterId ?? 0) + 1}`;
      
      if (clusterId === undefined || clusterId === null) {
        console.warn(`[ClusterRenderer] Record ${record.area_name} missing cluster_id field`);
        return;
      }
      
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, {
          id: clusterId,
          label: clusterName,
          members: [],
          avgSimilarity: 0,
          size: 0,
          centroid: this.calculateCentroid([record]),
          representativeAreas: []
        });
      }
      
      const cluster = clusterMap.get(clusterId)!;
      cluster.members.push(record);
      cluster.size++;
    });
    
    console.log(`[ClusterRenderer] ✅ Extracted ${clusterMap.size} clusters:`, 
      Array.from(clusterMap.values()).map(c => ({ id: c.id, label: c.label, size: c.size })));
    
    // Calculate final cluster statistics
    Array.from(clusterMap.values()).forEach(cluster => {
      cluster.avgSimilarity = cluster.members.reduce((sum, member) => 
        sum + (member.properties.similarity_score || 0), 0) / cluster.size;
      
      cluster.centroid = this.calculateCentroid(cluster.members);
      
      // Get top 3 most representative areas
      cluster.representativeAreas = cluster.members
        .sort((a, b) => (b.properties.similarity_score || 0) - (a.properties.similarity_score || 0))
        .slice(0, 3)
        .map(member => member.area_name);
    });
    
    // Sort clusters by ID to ensure consistent color assignment
    const sortedClusters = Array.from(clusterMap.values()).sort((a, b) => a.id - b.id);
    
    return {
      clusters: sortedClusters,
      clusterCount: clusterMap.size,
      totalMembers: data.records.length,
      avgClusterSize: data.records.length / clusterMap.size
    };
  }

  private generateClusterColors(clusterCount: number): string[] {
    // Always use standard red-to-green color scheme for consistency
    console.log('[ClusterRenderer] Using standard red-to-green colors for', clusterCount, 'clusters');
    
    // For 4 or fewer clusters, use the standard 4-color scheme
    if (clusterCount <= 4) {
      return ACTIVE_COLOR_SCHEME.slice(0, clusterCount);
    }
    
    // For 5 clusters, use the full quintile scheme (which is red-to-green)
    if (clusterCount === 5) {
      const quintileColors = getQuintileColorScheme();
      return quintileColors;
    }
    
    // For more than 5 clusters, cycle through red-to-green scheme
    const colors = [];
    for (let i = 0; i < clusterCount; i++) {
      colors.push(ACTIVE_COLOR_SCHEME[i % ACTIVE_COLOR_SCHEME.length]);
    }
    
    return colors;
  }

  private createClusterRenderer(clusterInfo: ClusterInfo, clusterColors: string[], config: VisualizationConfig): unknown {
    // Detect geometry type from config or use smart detection
    const geometryType = (config as any).geometryType || this.detectClusterGeometryType(clusterInfo);
    console.log('🔍 [ClusterRenderer] Detected geometryType:', geometryType, 'config.geometryType:', (config as any).geometryType);
    
    // For cluster rendering, use 'cluster_id' field from individual ZIP codes
    const valueField = 'cluster_id';
    console.log(`[ClusterRenderer] 🎯 Using field '${valueField}' for cluster coloring`);
    
    // Smart geometry handling based on data characteristics
    console.log('🔍 [ClusterRenderer] About to check if geometryType === polygon:', geometryType === 'polygon');
    if (geometryType === 'polygon') {
      console.log('✅ [ClusterRenderer] Taking POLYGON branch - should use filled areas for geographic regions');
      // Use polygon fills for geographic regions (ZIP codes, census tracts, etc.)
      const usePointClusters = false;
      
      if (usePointClusters) {
        console.log('[ClusterRenderer] Using enhanced firefly centroids for cluster point symbols');
        
        // FIREFLY-ENHANCED CLUSTER POINTS
        console.log('🎯 [ClusterRenderer] Using same colors as legend for firefly points');
        
        return {
          type: 'unique-value',
          field: valueField, // Use dynamic field from config
          uniqueValueInfos: clusterInfo.clusters.map((cluster, index) => {
            const baseSize = Math.max(12, Math.min(32, cluster.size / 3)); // Larger base sizes
            return {
            value: cluster.id,
            symbol: {
              type: 'simple-marker',
              style: 'circle',
                color: clusterColors[index], // Use same colors as legend
                size: baseSize,
              outline: {
                  color: clusterColors[index], // Match outline for seamless blend - use legend colors
                  width: 0
                },
                // CLUSTER FIREFLY ENHANCEMENT
                _fireflyEffect: {
                  glowSize: baseSize + 12,
                  intensity: Math.min(0.9, cluster.size / 20), // Intensity based on cluster size
                  pulseSpeed: 1800 + (index * 300), // Varying speeds per cluster
                  blendMode: 'screen'
              }
            },
            label: cluster.label
            };
          }),
          defaultSymbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [128, 128, 128, 0.3],
            size: 8
          },
          _useCentroids: true,
          _fireflyMode: true,
          _visualEffects: {
            glow: true,
            blend: 'screen',
            animation: 'pulse',
            quality: 'high'
          }
        };
      }
      
      // ENHANCED POLYGON CLUSTER VISUALIZATION
      console.log('🎯 [ClusterRenderer] Using POLYGON renderer - should show filled areas, not circles');
      console.log('🎯 [ClusterRenderer] Using same colors as legend for consistency');
      
        return {
          type: 'unique-value',
          field: valueField, // Use dynamic field from config
          uniqueValueInfos: clusterInfo.clusters.map((cluster, index) => ({
            value: cluster.id,
            symbol: {
              type: 'simple-fill',
              color: [...this.hexToRgbValues(clusterColors[index]), STANDARD_OPACITY], // Use standard opacity
              outline: {
                color: [0, 0, 0, 0], // No border
                width: 0
              }
            },
            label: cluster.label
          })),
          defaultSymbol: {
            type: 'simple-fill',
            color: [200, 200, 200, STANDARD_OPACITY],
            outline: {
              color: [0, 0, 0, 0], // No border
              width: 0
            }
          }
        };
    } else {
      console.log('❌ [ClusterRenderer] Taking POINT branch - geometryType was not polygon:', geometryType);
      // ENHANCED POINT GEOMETRY - firefly cluster symbols
      console.log('🎯 [ClusterRenderer] Using same colors as legend for point geometry');
      
      return {
        type: 'unique-value',
        field: valueField,
        uniqueValueInfos: clusterInfo.clusters.map((cluster, index) => {
          const baseSize = Math.max(14, Math.min(28, cluster.size / 2));
          return {
          value: cluster.id,
          symbol: {
            type: 'simple-marker',
            style: 'circle',
              color: clusterColors[index], // Use same colors as legend
              size: baseSize,
            outline: {
                color: clusterColors[index], // Use same colors as legend
                width: 0
              },
              // CLUSTER FIREFLY ENHANCEMENT
              _fireflyEffect: {
                glowSize: baseSize + 10,
                intensity: Math.min(0.85, cluster.size / 15),
                pulseSpeed: 2000 + (index * 200),
                blendMode: 'screen'
            }
          },
          label: cluster.label
          };
        }),
        _fireflyMode: true,
        _visualEffects: {
          glow: true,
          blend: 'screen',
          animation: 'pulse',
          quality: 'high'
        }
      };
    }
  }

  private createClusterPopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig): unknown {
    // Create cluster-specific popup content
    const content = [
      {
        type: 'text',
        text: '<h3>{' + (config.labelField || 'area_name') + '}</h3>'
      },
      {
        type: 'fields',
        fieldInfos: [
          {
            fieldName: config.valueField || 'value',
            label: 'Cluster Value'
          },
          {
            fieldName: 'category',
            label: 'Cluster Type'
          },
          {
            fieldName: 'rank',
            label: 'Similarity Rank'
          },
          {
            fieldName: 'properties.similarity_score',
            label: 'Similarity Score',
            format: {
              digitSeparator: true,
              places: 3
            }
          }
        ]
      }
    ];

    // Add cluster-specific information if available
    if (data.clusterAnalysis) {
      content.push({
        type: 'text',
        text: '<h4>Cluster Information</h4>'
      });
      
      content.push({
        type: 'fields',
        fieldInfos: [
          {
            fieldName: 'properties.cluster_size',
            label: 'Cluster Size'
          },
          {
            fieldName: 'properties.cluster_centroid_distance',
            label: 'Distance to Centroid',
            format: {
              digitSeparator: true,
              places: 2
            }
          }
        ]
      });
    }

    // Add SHAP values if available
    if (data.records.length > 0 && data.records[0].shapValues && Object.keys(data.records[0].shapValues).length > 0) {
      content.push({
        type: 'text',
        text: '<h4>Key Clustering Factors</h4>'
      });
      
      const topShapFields = Object.keys(data.records[0].shapValues)
        .slice(0, 3)
        .map(field => ({
          fieldName: `shapValues.${field}`,
          label: this.formatFieldLabel(field)
        }));
      
      content.push({
        type: 'fields',
        fieldInfos: topShapFields
      });
    }

    return {
      title: 'Cluster Analysis',
      content,
      outFields: ['*'],
      returnGeometry: true
    };
  }

  private createClusterLegend(clusterInfo: ClusterInfo, clusterColors: string[]): unknown {
    const numberEmojis = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    
    const legendItems = clusterInfo.clusters.map((cluster, index) => {
      // Use cluster ID + 1 to match analysis numbering (cluster ID 0 = ①, cluster ID 1 = ②, etc.)
      const displayNumber = cluster.id + 1;
      const numberIndicator = cluster.id < numberEmojis.length ? numberEmojis[cluster.id] : `(${displayNumber})`;
      return {
        label: `${numberIndicator} ${cluster.label} (${cluster.size} areas)`,
        color: this.hexToRgbaString(clusterColors[index], STANDARD_OPACITY), // Apply same opacity as map
        value: cluster.id,
        symbol: 'circle',
        description: `Avg similarity: ${(cluster.avgSimilarity * 100).toFixed(1)}%`
      };
    });

    // Keep legend items in cluster ID order to match color assignment
    // DO NOT sort by size as it breaks the color mapping

    return {
      title: `Spatial Clusters (${clusterInfo.clusterCount} groups)`,
      items: legendItems,
      position: 'bottom-right',
      type: 'categorical'
    };
  }

  private calculateCentroid(records: any[]): [number, number] {
    if (records.length === 0) return [0, 0];
    
    const sumLat = records.reduce((sum, record) => sum + (record.coordinates?.[1] || 0), 0);
    const sumLng = records.reduce((sum, record) => sum + (record.coordinates?.[0] || 0), 0);
    
    return [sumLng / records.length, sumLat / records.length];
  }


  private hexToRgbValues(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return [0, 0, 0];
    }
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ];
  }

  private hexToRgbaString(hex: string, opacity: number): string {
    const rgb = this.hexToRgbValues(hex);
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  }


  /**
   * Detect appropriate geometry type for cluster visualization based on data characteristics
   */
  private detectClusterGeometryType(clusterInfo: ClusterInfo): 'point' | 'polygon' {
    if (!clusterInfo.clusters || clusterInfo.clusters.length === 0) {
      return 'polygon'; // Default for spatial clusters
    }

    // Analyze cluster member names to determine if they represent properties or geographic areas
    const allMemberNames = clusterInfo.clusters.flatMap(cluster => 
      cluster.members.map(member => member.area_name?.toLowerCase() || '')
    );

    // Check for property/business indicators
    const propertyPattern = /(store|shop|#\d+|inc\.|ltd\.|llc|corp|restaurant|cafe|center|plaza|branch|location)/;
    const hasPropertyNames = allMemberNames.some(name => propertyPattern.test(name));

    // Check for ZIP codes or geographic area names
    const zipCodePattern = /^\d{5}(-\d{4})?$/;
    const geoAreaPattern = /(county|district|city|town|region|area|zone|neighborhood|tract|census|block|fsa)/i;
    const hasGeoAreaNames = allMemberNames.some(name => 
      zipCodePattern.test(name) || geoAreaPattern.test(name)
    );

    console.log('[ClusterRenderer] 🔍 detectClusterGeometryType analysis:', {
      hasPropertyNames,
      hasGeoAreaNames,
      sampleNames: allMemberNames.slice(0, 5),
      result: hasPropertyNames && !hasGeoAreaNames ? 'point' : 'polygon'
    });

    // If we have property names and no geographic area names, use points
    // Otherwise, use polygons for geographic clustering
    return hasPropertyNames && !hasGeoAreaNames ? 'point' : 'polygon';
  }

  private formatFieldLabel(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  // ============================================================================
  // CLUSTER CENTROID MARKERS (for enhanced visualization)
  // ============================================================================

  createCentroidMarkers(clusterInfo: ClusterInfo, clusterColors: string[]): unknown[] {
    return clusterInfo.clusters.map((cluster, index) => ({
      type: 'point',
      geometry: {
        type: 'point',
        longitude: cluster.centroid[0],
        latitude: cluster.centroid[1]
      },
      symbol: {
        type: 'simple-marker',
        style: 'diamond',
        color: clusterColors[index],
        size: Math.max(8, Math.min(16, cluster.size / 2)), // Size based on cluster size
        outline: {
          color: [0, 0, 0, 0], // No border
          width: 0
        }
      },
      attributes: {
        cluster_id: cluster.id,
        cluster_label: cluster.label,
        cluster_size: cluster.size,
        avg_similarity: cluster.avgSimilarity
      }
    }));
  }


}

// ============================================================================
// INTERFACES
// ============================================================================

interface ClusterInfo {
  clusters: ClusterDetails[];
  clusterCount: number;
  totalMembers: number;
  avgClusterSize: number;
}

interface ClusterDetails {
  id: number;
  label: string;
  members: any[];
  avgSimilarity: number;
  size: number;
  centroid: [number, number];
  representativeAreas: string[];
} 