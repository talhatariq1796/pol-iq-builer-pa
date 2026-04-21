/**
 * QuintileUtils - Utility functions for proper quintile calculations
 * 
 * Ensures equal feature distribution (20% of features in each quintile)
 * rather than value-based quintiles.
 */

export interface QuintileResult {
  quintiles: number[]; // The quintile boundaries
  classifications: number[]; // Classification (1-5) for each record
}

/**
 * Calculate proper quintiles with equal feature distribution
 * Each quintile should contain exactly 20% of the features
 */
export function calculateEqualCountQuintiles(values: number[]): QuintileResult {
  if (values.length === 0) {
    return {
      quintiles: [0, 0, 0, 0, 0],
      classifications: []
    };
  }

  // Sort values while keeping track of original indices
  const indexedValues = values.map((value, index) => ({ value, index }));
  indexedValues.sort((a, b) => a.value - b.value);

  const totalCount = values.length;
  const quintileSize = Math.floor(totalCount / 5);
  const remainder = totalCount % 5;

  // Calculate quintile boundaries based on equal counts
  const quintiles: number[] = [];
  const classifications: number[] = new Array(values.length);

  let currentIndex = 0;
  
  for (let q = 1; q <= 5; q++) {
    // Distribute remainder across first few quintiles
    const currentQuintileSize = quintileSize + (q <= remainder ? 1 : 0);
    
    // Assign classification to records in this quintile
    for (let i = 0; i < currentQuintileSize && currentIndex < totalCount; i++) {
      const originalIndex = indexedValues[currentIndex].index;
      classifications[originalIndex] = q;
      currentIndex++;
    }
    
    // Set quintile boundary to the maximum value in this quintile
    if (currentIndex > 0) {
      quintiles.push(indexedValues[currentIndex - 1].value);
    } else {
      quintiles.push(0);
    }
  }

  return {
    quintiles,
    classifications
  };
}

/**
 * Get quintile color scheme that works on both dark and light maps
 * Uses bright, high-contrast colors similar to competitive analysis
 */
export function getQuintileColorScheme(): string[] {
  return [
    '#FF4444', // Bright red (quintile 1 - lowest)
    '#FF8800', // Bright orange (quintile 2)
    '#FFDD00', // Bright yellow (quintile 3)
    '#88DD00', // Bright lime (quintile 4)
    '#00DD44'  // Bright green (quintile 5 - highest)
  ];
}

/**
 * Get quintile labels for legends
 */
export function getQuintileLabels(): string[] {
  return [
    'Bottom 20%',
    '20th-40th %ile',
    '40th-60th %ile', 
    '60th-80th %ile',
    'Top 20%'
  ];
}

/**
 * Create visualization config for quintile-based choropleth
 */
export function createQuintileVisualizationConfig(
  valueField: string,
  labelField: string,
  title: string
) {
  return {
    type: 'choropleth',
    config: {
      colorScheme: 'custom',
      customColors: getQuintileColorScheme(),
      classificationMethod: 'quintiles',
      opacity: 0.8,
      strokeWidth: 1,
      strokeColor: 'transparent',
      valueField,
      labelField,
      popupFields: [labelField, valueField],
      legend: {
        title,
        type: 'categorical',
        items: getQuintileLabels().map((label, index) => ({
          label,
          color: getQuintileColorScheme()[index],
          value: index + 1,
          symbol: 'square'
        }))
      }
    }
  };
}