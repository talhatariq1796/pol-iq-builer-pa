/**
 * VectorUtils - Utilities for vector operations and similarity search
 * 
 * Provides efficient similarity search and ranking for semantic routing.
 */

export interface SimilarityResult {
  id: string;
  score: number;
  metadata?: any;
}

export interface VectorIndex {
  [id: string]: {
    vector: number[];
    metadata?: any;
  };
}

export class VectorUtils {
  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  static euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Normalize a vector to unit length
   */
  static normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  /**
   * Find the most similar vectors in an index
   */
  static findMostSimilar(
    queryVector: number[],
    index: VectorIndex,
    topK: number = 5,
    threshold: number = 0.0
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const [id, entry] of Object.entries(index)) {
      const similarity = this.cosineSimilarity(queryVector, entry.vector);
      
      if (similarity >= threshold) {
        results.push({
          id,
          score: similarity,
          metadata: entry.metadata
        });
      }
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    // Return top K results
    return results.slice(0, topK);
  }

  /**
   * Find vectors within a similarity threshold
   */
  static findSimilarAboveThreshold(
    queryVector: number[],
    index: VectorIndex,
    threshold: number = 0.7
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const [id, entry] of Object.entries(index)) {
      const similarity = this.cosineSimilarity(queryVector, entry.vector);
      
      if (similarity >= threshold) {
        results.push({
          id,
          score: similarity,
          metadata: entry.metadata
        });
      }
    }

    // Sort by similarity score (descending)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate similarity matrix for a set of vectors
   */
  static calculateSimilarityMatrix(vectors: { [id: string]: number[] }): { [id1: string]: { [id2: string]: number } } {
    const matrix: { [id1: string]: { [id2: string]: number } } = {};
    const ids = Object.keys(vectors);

    for (const id1 of ids) {
      matrix[id1] = {};
      for (const id2 of ids) {
        if (id1 === id2) {
          matrix[id1][id2] = 1.0;
        } else {
          matrix[id1][id2] = this.cosineSimilarity(vectors[id1], vectors[id2]);
        }
      }
    }

    return matrix;
  }

  /**
   * Find cluster centers using k-means-like approach
   */
  static findClusters(
    vectors: { [id: string]: number[] },
    k: number = 3,
    maxIterations: number = 10
  ): { [clusterId: string]: string[] } {
    const ids = Object.keys(vectors);
    if (ids.length < k) {
      // If we have fewer vectors than clusters, each gets its own cluster
      const clusters: { [clusterId: string]: string[] } = {};
      ids.forEach((id, index) => {
        clusters[`cluster_${index}`] = [id];
      });
      return clusters;
    }

    // Initialize k random centers
    const centerIds = this.shuffleArray([...ids]).slice(0, k);
    let assignments: { [id: string]: number } = {};

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign each vector to nearest center
      const newAssignments: { [id: string]: number } = {};
      
      for (const id of ids) {
        let bestCenter = 0;
        let bestSimilarity = -1;
        
        for (let i = 0; i < centerIds.length; i++) {
          const similarity = this.cosineSimilarity(vectors[id], vectors[centerIds[i]]);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCenter = i;
          }
        }
        
        newAssignments[id] = bestCenter;
      }

      // Check for convergence
      if (this.assignmentsEqual(assignments, newAssignments)) {
        break;
      }
      
      assignments = newAssignments;
    }

    // Convert assignments to clusters
    const clusters: { [clusterId: string]: string[] } = {};
    for (let i = 0; i < k; i++) {
      clusters[`cluster_${i}`] = [];
    }

    for (const [id, clusterId] of Object.entries(assignments)) {
      clusters[`cluster_${clusterId}`].push(id);
    }

    return clusters;
  }

  /**
   * Helper function to shuffle an array
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Helper function to compare assignment objects
   */
  private static assignmentsEqual(a: { [id: string]: number }, b: { [id: string]: number }): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (a[key] !== b[key]) return false;
    }
    
    return true;
  }

  /**
   * Calculate average vector from a set of vectors
   */
  static calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= vectors.length;
    }
    
    return centroid;
  }

  /**
   * Measure vector quality metrics
   */
  static analyzeVectorQuality(vectors: { [id: string]: number[] }): {
    averageMagnitude: number;
    dimensionality: number;
    sparsity: number;
    averageSimilarity: number;
  } {
    const vectorArray = Object.values(vectors);
    if (vectorArray.length === 0) {
      return {
        averageMagnitude: 0,
        dimensionality: 0,
        sparsity: 0,
        averageSimilarity: 0
      };
    }

    // Calculate average magnitude
    const magnitudes = vectorArray.map(v => Math.sqrt(v.reduce((sum, val) => sum + val * val, 0)));
    const averageMagnitude = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;

    // Get dimensionality
    const dimensionality = vectorArray[0].length;

    // Calculate sparsity (percentage of near-zero values)
    const threshold = 0.001;
    let totalElements = 0;
    let nearZeroElements = 0;
    
    for (const vector of vectorArray) {
      totalElements += vector.length;
      nearZeroElements += vector.filter(val => Math.abs(val) < threshold).length;
    }
    
    const sparsity = nearZeroElements / totalElements;

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < vectorArray.length; i++) {
      for (let j = i + 1; j < vectorArray.length; j++) {
        totalSimilarity += this.cosineSimilarity(vectorArray[i], vectorArray[j]);
        pairCount++;
      }
    }
    
    const averageSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

    return {
      averageMagnitude,
      dimensionality,
      sparsity,
      averageSimilarity
    };
  }
}