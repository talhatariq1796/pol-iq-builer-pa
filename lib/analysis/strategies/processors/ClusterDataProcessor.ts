import { DataProcessorStrategy, RawAnalysisResult, ProcessedAnalysisData, GeographicDataPoint, AnalysisStatistics } from '../../types';
import { getTopFieldDefinitions, getPrimaryScoreField } from './HardcodedFieldDefs';

/**
 * ClusterDataProcessor - Handles data processing for the /spatial-clusters endpoint
 * 
 * Processes clustering analysis results with cluster assignments, similarity scores,
 * and cluster characteristic analysis.
 */
export class ClusterDataProcessor implements DataProcessorStrategy {
  private scoreField: string | undefined;
  
  validate(rawData: RawAnalysisResult): boolean {
    if (!rawData || typeof rawData !== 'object') return false;
    if (!rawData.success) return false;
    if (!Array.isArray(rawData.results)) return false;
    
    // Spatial clustering ONLY requires cluster_performance_score
    const hasClusterFields = rawData.results.length === 0 || 
      rawData.results.some(record => 
        record && 
        ((record as any).area_id || (record as any).id || (record as any).ID) &&
        (record as any).cluster_performance_score !== undefined
      );
    
    return hasClusterFields;
  }

  process(rawData: RawAnalysisResult): ProcessedAnalysisData {
    console.log('🚨🚨🚨 [ClusterDataProcessor] UPDATED VERSION EXECUTING - SHOULD SEE NEW CLUSTER LOGIC');
    if (!this.validate(rawData)) {
      throw new Error('Invalid data format for ClusterDataProcessor');
    }

  // Resolve canonical primary score field for this endpoint
  this.scoreField = getPrimaryScoreField('spatial_clustering', (rawData as any)?.metadata) || 'cluster_performance_score';

  // Process records with cluster information
  const records = this.processClusterRecords(rawData.results);
    
    // Calculate cluster statistics
    const statistics = this.calculateClusterStatistics(records);
    
    // Analyze cluster characteristics
    const clusterAnalysis = this.analyzeClusterCharacteristics(records);
    
    // Process feature importance for clustering
    const featureImportance = this.processClusterFeatureImportance(rawData.feature_importance || []);
    
    // Generate cluster summary
    const summary = this.generateClusterSummary(records, clusterAnalysis, rawData.summary);

    return {
      type: 'spatial_clustering',
      records,
      summary,
      featureImportance,
      statistics,
  targetVariable: this.scoreField || 'cluster_performance_score',
      clusterAnalysis // Additional metadata for cluster visualization
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  private processClusterRecords(rawRecords: any[]): GeographicDataPoint[] {
    // Use existing cluster_id and cluster_label from the dataset
    const clusterMap = new Map<number, any[]>();
    
    rawRecords.forEach(record => {
      // Use the predefined cluster_id from the dataset
      const clusterId = Number((record as any).cluster_id);
      const clusterLabel = (record as any).cluster_label || `Cluster ${clusterId}`;
      
      console.log('🔥 [ClusterDataProcessor] Using existing cluster_id:', clusterId, 'label:', clusterLabel, 'for record:', (record as any).ID);
      
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(record);
    });
    
    // Calculate average performance for each cluster and get top 5
    const clusterPerformances = Array.from(clusterMap.entries()).map(([clusterId, records]) => {
      const avgPerformance = records.reduce((sum, record) => 
        sum + (Number((record as any).cluster_performance_score) || 0), 0) / records.length;
      return { clusterId, records, avgPerformance };
    });
    
    // For cluster visualization, show all 5 clusters as centroids instead of individual areas
    console.log('🔍 [ClusterDataProcessor] All clusters before centroid creation:', clusterPerformances.map(c => `Cluster ${c.clusterId}: ${c.records.length} records, avg ${c.avgPerformance.toFixed(1)}`));
    
    // Create cluster centroid records (one representative record per cluster)
    const clusterCentroids = clusterPerformances.map(cluster => {
      // Find the most representative record for this cluster (highest similarity/performance)
      const sortedRecords = cluster.records.sort((a, b) => {
        const scoreA = Number(a.cluster_performance_score) || 0;
        const scoreB = Number(b.cluster_performance_score) || 0;
        return scoreB - scoreA;
      });
      
      const representativeRecord = sortedRecords[0]; // Best record in cluster
      const centroidCoordinates = this.calculateCentroid(cluster.records);
      
      // Create a centroid record representing this entire cluster
      return {
        ...representativeRecord,
        // Override coordinates with true centroid
        coordinates: centroidCoordinates,
        // Add cluster metadata
        clusterId: cluster.clusterId,
        cluster_size: cluster.records.length,
        cluster_average_performance: cluster.avgPerformance,
        is_cluster_centroid: true,
        represented_areas: cluster.records.length,
        // Override geometry to be a point at centroid location
        geometry: {
          type: 'Point',
          coordinates: centroidCoordinates
        }
      };
    });
    
    console.log('🎯 [ClusterDataProcessor] Created', clusterCentroids.length, 'cluster centroids representing', clusterPerformances.reduce((sum, c) => sum + c.records.length, 0), 'total areas');
    
    // Use cluster centroids instead of individual records
    const topClusterRecords = clusterCentroids;
    
    return topClusterRecords.map((record, index) => {
      const area_id = `cluster_${(record as any).clusterId || index}`;
      const area_name = `Cluster ${(record as any).clusterId || index + 1} (${(record as any).represented_areas} areas)`;
      
  // Spatial clustering ONLY uses cluster_performance_score - no fallbacks
  const clusterPerformanceScore = Number((record as any).cluster_performance_score);
      
      if (isNaN(clusterPerformanceScore)) {
        throw new Error(`Spatial clustering record ${(record as any).ID || index} is missing cluster_performance_score`);
      }
      
      // Use the existing cluster_id from the dataset
      const clusterId = Number((record as any).cluster_id);
      const value = clusterId;
      
      // Extract cluster-specific properties
      const properties = {
        ...record,
        // Mirror canonical scoring field name into properties
        [this.scoreField || 'cluster_performance_score']: clusterPerformanceScore,
        score_source: this.scoreField || 'cluster_performance_score',
        cluster_id: clusterId,
        cluster_label: (record as any).cluster_label || this.getClusterLabel(clusterId), // Use existing labels from dataset
        cluster_size: (record as any).cluster_size || 0,
        similarity_score: Number((record as any).similarity_score) || 0
      };
      
      // Extract SHAP values
      const shapValues = this.extractShapValues(record);
      
      // Category is the cluster name/label (use existing labels from dataset)
      const category = (record as any).cluster_label || this.getClusterLabel(clusterId);

      const outRec: any = {
        area_id,
        area_name,
        value,
        rank: Math.round(((record as any).similarity_score || 0) * 100), // Use similarity as rank (0-100)
        category,
        coordinates: (record as any).coordinates || [0, 0],
        properties,
        shapValues
      };

      // Mirror canonical field on top-level for downstream consumers
      outRec[this.scoreField || 'cluster_performance_score'] = clusterPerformanceScore;

      return outRec;
    });
  }

  private extractSimilarityScore(record: any): number {
    // PRIORITIZE PRE-CALCULATED SIMILARITY SCORE
    if ((record as any).similarity_score !== undefined && (record as any).similarity_score !== null) {
      const preCalculatedScore = Number((record as any).similarity_score);
      return Math.max(0, Math.min(1, preCalculatedScore)); // Ensure 0-1 range
    }
    
    // Try multiple similarity/distance fields
    const similarityFields = [
      'cluster_performance_score', 'similarity', 'score', 'confidence',
      'distance', 'cluster_centroid_distance', 'centroid_distance', 'cluster_strength'
    ];
    
    for (const field of similarityFields) {
      if (record[field] !== undefined && record[field] !== null) {
        let score = Number(record[field]);
        if (!isNaN(score)) {
          // If it's a distance, convert to similarity (inverse)
          if (field.includes('distance')) {
            score = Math.max(0, 1 - (score / 10)); // Normalize distance to 0-1 similarity
          }
          return Math.max(0, Math.min(1, score)); // Ensure 0-1 range
        }
      }
    }
    
    return 0.5; // Default moderate similarity
  }

  private extractProperties(record: any): Record<string, any> {
    const internalFields = new Set([
      'area_id', 'id', 'area_name', 'name', 'cluster_id', 'cluster',
      'similarity_score', 'coordinates', 'shap_values'
    ]);
    
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (!internalFields.has(key)) {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  private extractShapValues(record: any): Record<string, number> {
    if ((record as any).shap_values && typeof (record as any).shap_values === 'object') {
      return (record as any).shap_values;
    }
    
    const shapValues: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(record)) {
      if ((key.includes('shap') || key.includes('impact') || key.includes('contribution')) 
          && typeof value === 'number') {
        shapValues[key] = value;
      }
    }
    
    return shapValues;
  }

  private getClusterLabel(clusterId: number): string {
    // Use performance-based cluster labels for clarity
    switch (clusterId) {
      case 0: return 'High Performance Markets';
      case 1: return 'Medium-High Performance Markets';
      case 2: return 'Medium Performance Markets';
      case 3: return 'Developing Markets';
      case 4: return 'Emerging Markets';
      default: return 'Unknown Cluster';
    }
  }

  private calculateClusterStatistics(records: GeographicDataPoint[]): AnalysisStatistics {
    const similarityScores = records.map(r => (r.properties as any).similarity_score || 0);
    const clusterSizes = records.map(r => (r.properties as any).cluster_size || 0);
    
    if (similarityScores.length === 0) {
      return {
        total: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0,
        clusterCount: 0, avgClusterSize: 0, avgSimilarity: 0
      };
    }
    
    const sorted = [...similarityScores].sort((a, b) => a - b);
    const total = similarityScores.length;
    const sum = similarityScores.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    const median = total % 2 === 0 
      ? (sorted[Math.floor(total / 2) - 1] + sorted[Math.floor(total / 2)]) / 2
      : sorted[Math.floor(total / 2)];
    
    const variance = similarityScores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Cluster-specific statistics
    const uniqueClusters = new Set(records.map(r => r.value)).size;
    const avgClusterSize = clusterSizes.reduce((a, b) => a + b, 0) / total;
    
    return {
      total,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      clusterCount: uniqueClusters,
      avgClusterSize,
      avgSimilarity: mean
    };
  }

  private analyzeClusterCharacteristics(records: GeographicDataPoint[]): any {
    const clusterMap = new Map<number, GeographicDataPoint[]>();
    
    // Group records by cluster
    records.forEach(record => {
      const clusterId = (record as any).value;
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(record);
    });
    
    // Analyze each cluster
    const clusterCharacteristics = Array.from(clusterMap.entries()).map(([clusterId, clusterRecords]) => {
      const avgSimilarity = clusterRecords.reduce((sum, r) => sum + ((r.properties as any).similarity_score || 0), 0) / clusterRecords.length;
      const size = clusterRecords.length;
      const label = this.getClusterLabel(clusterId);
      
      // Calculate cluster centroid (average characteristics)
      const centroid = this.calculateClusterCentroid(clusterRecords);
      
      return {
        id: clusterId,
        label,
        size,
        avgSimilarity,
        centroid,
        representativeAreas: clusterRecords
          .sort((a, b) => ((b.properties as any).similarity_score || 0) - ((a.properties as any).similarity_score || 0))
          .slice(0, 3)
          .map(r => r.area_name)
      };
    });
    
    return {
      clusters: clusterCharacteristics,
      totalClusters: clusterCharacteristics.length,
      silhouetteScore: this.calculateSilhouetteScore(records) // Measure of clustering quality
    };
  }

  private calculateClusterCentroid(clusterRecords: GeographicDataPoint[]): Record<string, number> {
    const centroid: Record<string, number> = {};
    const numericFields = new Set<string>();
    
    // Identify numeric fields
    clusterRecords.forEach(record => {
      Object.entries((record as any).properties).forEach(([key, value]) => {
        if (typeof value === 'number' && !isNaN(value)) {
          numericFields.add(key);
        }
      });
    });
    
    // Calculate averages for numeric fields
    numericFields.forEach(field => {
      const values = clusterRecords
        .map(r => (r.properties as any)[field])
        .filter(v => typeof v === 'number' && !isNaN(v)) as number[];
      
      if (values.length > 0) {
        centroid[field] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });
    
    return centroid;
  }

  private calculateSilhouetteScore(records: GeographicDataPoint[]): number {
    // Simplified silhouette score calculation
    // In a real implementation, this would use proper distance metrics
    
    const clusterMap = new Map<number, GeographicDataPoint[]>();
    records.forEach(record => {
      const clusterId = (record as any).value;
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(record);
    });
    
    if (clusterMap.size <= 1) return 0; // No meaningful clustering
    
    // For now, return average similarity score as a proxy
    const avgSimilarity = records.reduce((sum, r) => sum + ((r.properties as any).similarity_score || 0), 0) / records.length;
    return avgSimilarity;
  }

  private processClusterFeatureImportance(rawFeatureImportance: any[]): any[] {
    return rawFeatureImportance.map(item => ({
      feature: (item as any).feature || (item as any).name || 'unknown',
      importance: Number((item as any).importance || (item as any).value || 0),
      description: this.getClusterFeatureDescription((item as any).feature || (item as any).name),
      clusterContribution: (item as any).cluster_contribution || 'all' // Which clusters this feature most affects
    })).sort((a, b) => b.importance - a.importance);
  }

  private getClusterFeatureDescription(featureName: string): string {
    const descriptions: Record<string, string> = {
      'income': 'Economic clustering factor',
      'age': 'Age-based demographic clustering',
      'education': 'Education-level clustering',
      'population': 'Population density clustering',
      'housing': 'Housing type clustering',
      'employment': 'Employment pattern clustering',
      'transportation': 'Transportation access clustering',
      'lifestyle': 'Lifestyle preference clustering'
    };
    
    const lowerName = featureName.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }
    
    return `${featureName} clustering characteristics`;
  }

  private generateClusterSummary(
    records: GeographicDataPoint[], 
    clusterAnalysis: any, 
    rawSummary?: string
  ): string {
    const clusterCount = clusterAnalysis.totalClusters;
    const avgSimilarity = clusterAnalysis.silhouetteScore;
    
    // Calculate cluster baseline metrics
    const avgClusterSize = records.length / clusterCount;
    const clusterSizes = clusterAnalysis.clusters.map((c: any) => c.size);
    const maxClusterSize = Math.max(...clusterSizes);
    const minClusterSize = Math.min(...clusterSizes);
    const avgDistanceToCenter = records.reduce((sum, r) => sum + ((r.properties as any).cluster_centroid_distance || 0), 0) / records.length;
    
    // Start with clustering explanation
    let summary = `**🗺️ Spatial Clustering Methodology:** Areas are grouped based on similar demographic and economic characteristics. Similarity scores (0-100%) measure how well each area fits its assigned cluster. Distance scores measure proximity to cluster center characteristics.

`;
    
    summary += `**📊 Clustering Baseline & Averages:** `;
    summary += `${clusterCount} distinct clusters identified with ${(avgSimilarity * 100).toFixed(1)}% clustering quality (0-100% scale). `;
    summary += `Cluster size baseline: ${avgClusterSize.toFixed(1)} areas average (range: ${minClusterSize}-${maxClusterSize}), `;
    summary += `${avgDistanceToCenter.toFixed(2)} average distance to cluster centers. `;
    
    // Cluster distribution analysis
    const largeCluster = clusterAnalysis.clusters.filter((c: any) => c.size > avgClusterSize * 1.5).length;
    const mediumCluster = clusterAnalysis.clusters.filter((c: any) => c.size >= avgClusterSize * 0.5 && c.size <= avgClusterSize * 1.5).length;
    const smallCluster = clusterAnalysis.clusters.filter((c: any) => c.size < avgClusterSize * 0.5).length;
    
    summary += `Cluster distribution: ${largeCluster} large clusters, ${mediumCluster} medium clusters, ${smallCluster} small clusters.

`;
    
    summary += `**Spatial Analysis Complete:** ${clusterCount} distinct geographic clusters identified from ${records.length} areas with ${(avgSimilarity * 100).toFixed(1)}% clustering quality. `;
    
    // Enhanced cluster breakdown with specific areas
    if (clusterAnalysis.clusters.length > 0) {
      const majorClusters = clusterAnalysis.clusters
        .sort((a: any, b: any) => b.size - a.size)
        .slice(0, 4); // Show top 4 clusters
      
      majorClusters.forEach((cluster: any, index: number) => {
        const percentage = (cluster.size / records.length * 100).toFixed(1);
        summary += `**${cluster.label} Cluster** (${cluster.size} areas, ${percentage}%): `;
        
        // Add representative areas for this cluster
        if (cluster.representativeAreas && cluster.representativeAreas.length > 0) {
          const areas = cluster.representativeAreas.slice(0, 5);
          summary += `${areas.join(', ')}. `;
        }
        
        // Add cluster characteristics
        summary += `Characterized by ${this.getClusterCharacteristics(cluster)}. `;
        
        if (cluster.avgSimilarity) {
          summary += `Average similarity: ${(cluster.avgSimilarity * 100).toFixed(1)}%. `;
        }
      });
    }
    
    // Cross-cluster insights
    if (clusterAnalysis.clusters.length > 1) {
      summary += `**Cross-Cluster Insights:** `;
      
      // Find clusters with bridging characteristics
      const bridgingAreas = this.identifyBridgingAreas(clusterAnalysis.clusters, records);
      if (bridgingAreas.length > 0) {
        summary += `${bridgingAreas.slice(0, 3).join(', ')} show characteristics spanning multiple clusters. `;
      }
      
      // Identify cluster transitions
      const transitions = this.identifyClusterTransitions(clusterAnalysis.clusters);
      if (transitions.length > 0) {
        summary += `${transitions.join(', ')} represent transition zones with mixed characteristics. `;
      }
    }
    
    // Strategic recommendations by cluster
    summary += `**Strategic Recommendations:** `;
    
    if (clusterAnalysis.clusters.length > 0) {
      const topCluster = clusterAnalysis.clusters.reduce((max: any, cluster: any) => 
        cluster.avgSimilarity > max.avgSimilarity ? cluster : max, { avgSimilarity: 0 });
      
      if (topCluster.avgSimilarity > 0) {
        summary += `Focus immediate attention on ${topCluster.label} cluster for consistent performance patterns. `;
      }
      
      // Identify opportunity clusters
      const opportunityClusters = clusterAnalysis.clusters
        .filter((c: any) => c.size >= records.length * 0.1 && c.avgSimilarity > avgSimilarity)
        .slice(0, 2);
      
      if (opportunityClusters.length > 0) {
        const clusterNames = opportunityClusters.map((c: any) => c.label);
        summary += `Develop targeted strategies for ${clusterNames.join(' and ')} clusters. `;
      }
    }
    
    // Geographic pattern insights
    const geographicPatterns = this.analyzeGeographicPatterns(clusterAnalysis.clusters);
    if (geographicPatterns.length > 0) {
      summary += `**Geographic Patterns:** ${geographicPatterns.join('. ')}. `;
    }
    
    if (rawSummary) {
      summary += rawSummary;
    }
    
    return summary;
  }

  private getClusterCharacteristics(cluster: any): string {
    // Generate characteristics based on cluster centroid
    const characteristics = [];
    
    if (cluster.centroid) {
      // Income characteristics
      if (cluster.centroid.value_AVGHINC_CY > 70000) {
        characteristics.push('high income levels');
      } else if (cluster.centroid.value_AVGHINC_CY > 45000) {
        characteristics.push('moderate income levels');
      } else if (cluster.centroid.value_AVGHINC_CY) {
        characteristics.push('developing income levels');
      }
      
      // Population characteristics
      if (cluster.centroid.value_TOTPOP_CY > 50000) {
        characteristics.push('high population density');
      } else if (cluster.centroid.value_TOTPOP_CY > 20000) {
        characteristics.push('moderate population density');
      } else if (cluster.centroid.value_TOTPOP_CY) {
        characteristics.push('low population density');
      }
      
      // Age characteristics
      if (cluster.centroid.value_MEDAGE_CY < 35) {
        characteristics.push('younger demographics');
      } else if (cluster.centroid.value_MEDAGE_CY > 45) {
        characteristics.push('mature demographics');
      } else if (cluster.centroid.value_MEDAGE_CY) {
        characteristics.push('mixed age demographics');
      }
    }
    
    if (characteristics.length === 0) {
      return `similar geographic and demographic patterns`;
    }
    
    return characteristics.slice(0, 3).join(', ');
  }

  private identifyBridgingAreas(clusters: any[], records: GeographicDataPoint[]): string[] {
    // Find areas that have characteristics similar to multiple clusters
    const bridgingAreas: string[] = [];
    
    // This is a simplified implementation - in practice, you'd analyze similarity scores
    // across multiple clusters to find areas that bridge cluster characteristics
    if (clusters.length >= 2) {
      const sampleAreas = records.slice(0, 3).map(r => r.area_name);
      bridgingAreas.push(...sampleAreas);
    }
    
    return bridgingAreas;
  }

  private identifyClusterTransitions(clusters: any[]): string[] {
    // Identify transition zones between clusters
    const transitions: string[] = [];
    
    if (clusters.length >= 2) {
      // Simplified - would analyze geographic proximity and characteristic gradients
      clusters.slice(0, 2).forEach((cluster: any) => {
        if (cluster.label && cluster.size > 5) {
          transitions.push(`${cluster.label} transition zone`);
        }
      });
    }
    
    return transitions;
  }

  private analyzeGeographicPatterns(clusters: any[]): string[] {
    const patterns: string[] = [];
    
    if (clusters.length > 0) {
      // Analyze cluster sizes for patterns
      const sizes = clusters.map((c: any) => c.size).sort((a: number, b: number) => b - a);
      
      if (sizes[0] > sizes[1] * 2) {
        patterns.push('One dominant cluster with several smaller specialized groups');
      } else if (sizes.length >= 3 && sizes[0] / sizes[2] < 1.5) {
        patterns.push('Evenly distributed cluster sizes indicating diverse geographic characteristics');
      }
      
      // Analyze similarity patterns
      const avgSimilarities = clusters.map((c: any) => c.avgSimilarity || 0);
      const highSimilarityClusters = avgSimilarities.filter(s => s > 0.7).length;
      
      if (highSimilarityClusters > clusters.length * 0.6) {
        patterns.push('Strong within-cluster cohesion suggests clear geographic boundaries');
      }
    }
    
    return patterns;
  }

  /**
   * Calculate centroid coordinates from cluster records
   */
  private calculateCentroid(records: any[]): [number, number] {
    if (records.length === 0) return [0, 0];
    
    let totalLat = 0;
    let totalLon = 0;
    let validCoords = 0;
    
    records.forEach(record => {
      if ((record as any).coordinates && Array.isArray((record as any).coordinates) && (record as any).coordinates.length >= 2) {
        totalLon += (record as any).coordinates[0];
        totalLat += (record as any).coordinates[1];
        validCoords++;
      }
    });
    
    if (validCoords === 0) return [0, 0];
    
    return [totalLon / validCoords, totalLat / validCoords];
  }
  /**
   * Extract field value from multiple possible field names
   */
  private extractFieldValue(record: any, fieldNames: string[]): number {
    for (const fieldName of fieldNames) {
      const value = Number(record[fieldName]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    return 0;
  }

} 