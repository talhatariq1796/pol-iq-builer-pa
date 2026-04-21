/* eslint-disable @typescript-eslint/no-explicit-any */
import Color from "@arcgis/core/Color";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import { 
  RendererConfig, 
  RendererResult, 
  ColorStop 
} from './types';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY } from './renderer-standardization';

// Use active color scheme from renderer standardization
const DEFAULT_COLOR_STOPS: ColorStop[] = ACTIVE_COLOR_SCHEME.slice(0, 5).map(color => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!result) return [239, 59, 44];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
});


// Grey color for filtered-out features
const FILTERED_OUT_COLOR: ColorStop = [150, 150, 150]; // Grey

// Update type definition
interface CalculateQuantilesOptions {
  excludeZeros?: boolean;
  numberOfBreaks?: number;
  customBreaks?: number[];
  numBreaks?: number;
  isNormalized?: boolean;
}

const calculateQuantiles = async (
  layer: __esri.FeatureLayer, 
  field: string,
  options: CalculateQuantilesOptions = {}
): Promise<number[]> => {
  const { excludeZeros = false, numBreaks = 4, isNormalized = false } = options;

  try {
    if (!layer || !field) {
      console.warn('Invalid layer or field for calculating quantiles');
      return [25, 50, 75, 100]; // Default values
    }

    if (!layer.loaded) {
      await layer.load();
    }

    const query = layer.createQuery();
    query.where = excludeZeros ? `${field} > 0` : "1=1";
    query.outFields = [field];
    query.returnGeometry = false;
    
    const featureSet = await layer.queryFeatures(query);
    
    if (!featureSet || !featureSet.features || featureSet.features.length === 0) {
      console.warn(`No valid features found for field ${field} when calculating quantiles`);
      return [25, 50, 75, 100]; // Default breaks
    }

    // Extract values, filter out null and undefined
    let values = featureSet.features
      .map(f => f.attributes[field])
      .filter((val): val is number => val !== null && val !== undefined && !isNaN(val));
    
    // Handle normalization if requested
    if (isNormalized) {
      // Find min and max for normalization
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Normalize to 0-100 scale
      if (max > min) {
        values = values.map(v => Math.round(((v - min) / (max - min)) * 100));
      } else {
        // If all values are the same, normalize based on absolute value
        values = values.map(v => v > 0 ? 100 : 0);
      }
    }
    
    // Sort values
    values.sort((a, b) => a - b);
    
    // Calculate quantile breaks - this ensures equal number of features in each class
    const breaks = [];
    for (let i = 1; i <= numBreaks; i++) {
      const index = Math.floor((i / numBreaks) * values.length) - 1;
      const validIndex = Math.max(0, Math.min(index, values.length - 1));
      breaks.push(values[validIndex]);
    }
    
    // Make sure the last break is the max value
    if (values.length > 0 && breaks[breaks.length - 1] !== values[values.length - 1]) {
      breaks[breaks.length - 1] = values[values.length - 1];
    }
    
    // Make sure breaks are unique and in ascending order
    const uniqueBreaks = [...new Set(breaks)].sort((a, b) => a - b);
    
    // If we couldn't get enough unique breaks, fill with evenly spaced values
    if (uniqueBreaks.length < numBreaks) {
      const min = uniqueBreaks[0] || 0;
      const max = uniqueBreaks[uniqueBreaks.length - 1] || 100;
      
      return Array.from({ length: numBreaks }, (_, i) => 
        Math.round(min + (i + 1) * ((max - min) / numBreaks))
      );
    }
    
    return uniqueBreaks;
  } catch (error) {
    console.error(`Error calculating quantiles for field ${field}:`, error);
    return [25, 50, 75, 100]; // Default values
  }
};

const createQuartileRenderer = async (
  config: RendererConfig
): Promise<RendererResult> => {
  const {
    layer,
    field,
    colorStops = DEFAULT_COLOR_STOPS,
    isCurrency = false,
    isCompositeIndex = false,
    opacity = STANDARD_OPACITY,
    customBreaks,
    filterField,           // New: field to use for filtering
    filterThreshold        // New: threshold value for filtering
  } = config;

  if (!layer || !field) {
    console.warn('Invalid inputs for renderer creation');
    return null;
  }

  // Skip system fields that shouldn't be used for statistical calculations
  const systemFields = ['esri_pid', 'esri_oid', 'objectid', 'fid', 'shape_length', 'shape_area', 'shape__length', 'shape__area'];
  if (systemFields.includes(field.toLowerCase())) {
    console.warn(`[createQuartileRenderer] Skipping system field: ${field}`);
    return null;
  }

  try {
    if (!layer.loaded) {
      await layer.load();
    }

    console.log(`🔥 [STRATEGIC VIZ DEBUG] createQuartileRenderer called with field: '${field}'`);
    console.log(`🔥 [STRATEGIC VIZ DEBUG] Available fields in layer:`, layer.fields?.map(f => f.name) || 'none');
    
    // Also check the first feature to see what attributes are actually available
    const testQuery = layer.createQuery();
    testQuery.outFields = ['*'];
    testQuery.returnGeometry = false;
    testQuery.num = 1;
    
    try {
      const testFeatureSet = await layer.queryFeatures(testQuery);
      if (testFeatureSet.features && testFeatureSet.features.length > 0) {
        const firstFeature = testFeatureSet.features[0];
        console.log(`🔥 [STRATEGIC VIZ DEBUG] First feature attributes:`, Object.keys(firstFeature.attributes));
        console.log(`🔥 [STRATEGIC VIZ DEBUG] Target field '${field}' value:`, firstFeature.attributes[field]);
        console.log(`🔥 [STRATEGIC VIZ DEBUG] Strategic value score:`, firstFeature.attributes['strategic_value_score']);
      }
    } catch (testError) {
      console.warn('Could not query test feature:', testError);
    }

    const fieldInfo = layer.fields?.find(f => f.name === field);
    if (!fieldInfo) {
      throw new Error(`Field '${field}' not found in visualization layer '${layer.title}'. Available fields: ${layer.fields?.map(f => f.name).join(', ')}`);
    }

    // Use custom breaks if provided, otherwise calculate quantiles
    const breaks = customBreaks || await calculateQuantiles(layer, field, {
      excludeZeros: !isCompositeIndex,
      isNormalized: false // No normalization needed
    });

    // Special debugging for Google Pay layer
    if (layer.title?.includes('Google Pay')) {
      console.log(`🔍 [GOOGLE PAY DEBUG] Quantile calculation results:`, {
        field,
        isNormalized: false,
        calculatedBreaks: breaks,
        breakRanges: breaks.map((val, i) => i === 0 ? `0 - ${val}` : `${breaks[i-1]} - ${val}`),
        uniqueBreaks: new Set(breaks).size,
        totalBreaks: breaks.length,
        isCustomBreaks: !!customBreaks
      });
      
      // Check for identical or near-identical breaks
      const uniqueValues = new Set(breaks);
      if (uniqueValues.size < breaks.length) {
        console.warn(`🔍 [GOOGLE PAY DEBUG] WARNING: Duplicate breaks detected!`, {
          uniqueCount: uniqueValues.size,
          totalCount: breaks.length,
          breaks: breaks
        });
      }
    }


    // For custom breaks, ensure we include 0 as the first break
    const finalBreaks = customBreaks ? [0, ...breaks] : breaks;

    // Determine if this is a point layer
    const isPointLayer = layer.geometryType === 'point';
    
    // Define custom colors for Google Trends layers
    const effectiveColorStops = colorStops;
    

    // CHANGE: Get the lowest category color for no-data/0 values (usually red)
    
    // CHANGE: Make the default symbol match the lowest category (red) instead of gray
    // This ensures areas with no data or with OBJECTID but no value will show as red

    // Create appropriate symbol
    const createSymbol = (colorArray: number[], value: number) => {
      if (isPointLayer) {
        return {
          type: "simple-marker" as const,
          style: "circle" as const,
          color: new Color([...colorArray, opacity]),
          size: value === 0 && !isCompositeIndex ? 4 : 8,
          outline: {
            width: 0
          }
        };
      }
      return {
        type: "simple-fill" as const,
        color: new Color([...colorArray, opacity]),
        outline: {
          width: 0,
          color: [0, 0, 0, 0]
        }
      };
    };

    // Helper for currency formatting
    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    // Determine if this is a count field
    const typedLayer = layer as any;
    const isCount = typedLayer.metadata?.valueType === 'count';

    // Create the visualization renderer
    let renderer: __esri.ClassBreaksRenderer;
    
    // If filtering is enabled with both filterField and filterThreshold
    if (filterField && filterThreshold !== undefined) {

      // Create a class-breaks renderer with Arcade expression
      renderer = new ClassBreaksRenderer({
        valueExpression: `
          // Get the feature's filter field value
          var filterValue = $feature["${filterField}"];
          
          // If filter value is below threshold or null, return -1 (special value for filtered out)
          if (filterValue == null || filterValue < ${filterThreshold}) {
            return -1;
          }
          
          // Otherwise return the actual value for normal class breaks rendering
          return $feature["${field}"];
        `,
        defaultLabel: "No data",
        defaultSymbol: createSymbol([150, 150, 150], 0)
      });

      // Add a special break for filtered out values
      renderer.addClassBreakInfo({
        minValue: -1,
        maxValue: 0,
        symbol: createSymbol(FILTERED_OUT_COLOR, 0),
        label: `Below threshold (< ${filterThreshold} applications)`
      });

      // Add normal breaks for values above threshold
      finalBreaks.forEach((breakValue, i) => {
        const colorIndex = isCompositeIndex ? (finalBreaks.length - 1 - i) : i;
        const colorArray = effectiveColorStops[colorIndex] || effectiveColorStops[0];
        
        const minValue = i === 0 ? 0 : finalBreaks[i - 1];
        
        // Format the values based on whether it's a count or currency
        const formattedMaxValue = isCount
          ? Math.round(breakValue).toLocaleString()
          : isCurrency
          ? formatCurrency(breakValue)
          : breakValue.toLocaleString();
          
        const formattedMinValue = isCount
          ? Math.round(minValue).toLocaleString()
          : isCurrency
          ? formatCurrency(minValue)
          : minValue.toLocaleString();

        // Create standard quartile labels with < and > format
        const label = i === 0
          ? `< ${formattedMaxValue}`
          : i === finalBreaks.length - 1
          ? `> ${formattedMinValue}`
          : `${formattedMinValue} - ${formattedMaxValue}`;

        renderer.addClassBreakInfo({
          minValue: minValue,
          maxValue: breakValue,
          symbol: createSymbol(colorArray, breakValue),
          label: label
        });
      });
    } else {
      // Use standard class breaks renderer if no filtering is needed
      renderer = new ClassBreaksRenderer({
        field: field,
        defaultLabel: "No data",
        defaultSymbol: createSymbol([150, 150, 150], 0),
        classBreakInfos: finalBreaks.map((breakValue, i) => {
          const colorIndex = isCompositeIndex ? (finalBreaks.length - 1 - i) : i;
          const colorArray = effectiveColorStops[colorIndex] || effectiveColorStops[0];
          
          
          const minValue = i === 0 ? 0 : finalBreaks[i - 1];
          
          // Format the values based on whether it's a count or currency
          const formattedMaxValue = isCount
            ? Math.round(breakValue).toLocaleString()
            : isCurrency
            ? formatCurrency(breakValue)
            : breakValue.toLocaleString();
            
          const formattedMinValue = isCount
            ? Math.round(minValue).toLocaleString()
            : isCurrency
            ? formatCurrency(minValue)
            : minValue.toLocaleString();

          // Create standard quartile labels with < and > format
          const label = i === 0
            ? `< ${formattedMaxValue}`
            : i === finalBreaks.length - 1
            ? `> ${formattedMinValue}`
            : `${formattedMinValue} - ${formattedMaxValue}`;

          return {
            minValue: minValue,
            maxValue: breakValue,
            symbol: createSymbol(colorArray, breakValue),
            label: label
          };
        })
      });
    }

    // Calculate statistics for the return value
    const statistics = {
      min: finalBreaks[0],
      max: finalBreaks[finalBreaks.length - 1],
      mean: finalBreaks.reduce((a, b) => a + b, 0) / finalBreaks.length,
      median: finalBreaks[Math.floor(finalBreaks.length / 2)]
    };

    return {
      renderer,
      breaks: finalBreaks,
      statistics
    };

  } catch (error) {
    console.error(`Error creating renderer for layer ${layer.title}:`, error);
    return null;
  }
};

export { createQuartileRenderer, calculateQuantiles };