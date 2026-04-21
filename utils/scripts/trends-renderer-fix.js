/**
 * Enhanced Google Trends Layer Fix - Specifically targets renderer issues
 * Copy and paste this entire file into your browser's developer console to fix the Google Trends layers
 */

(function() {
  console.log('=== GOOGLE TRENDS RENDERER FIX ===');
  
  // Find the map view
  let view = null;
  
  // Try window.mapView first (most common global reference)
  if (window.mapView) {
    view = window.mapView;
  } else if (window.view) {
    view = window.view;
  } else {
    // Look for any variable in the global scope that might be the map view
    for (const key in window) {
      const potential = window[key];
      if (potential && 
          potential.type && 
          (potential.type === "2d" || potential.type === "3d") && 
          potential.map) {
        view = potential;
        console.log(`Found map view in window.${key}`);
        break;
      }
    }
  }
  
  if (!view) {
    console.error('Could not find the map view. Please make sure the map is initialized.');
    return;
  }
  
  console.log(`Found ${view.type} view`);
  
  // Find all trend layers
  const allLayers = view.map.allLayers.toArray();
  
  // Find the base Google Trends layer
  const baseTrendsLayer = allLayers.find(layer => layer.id === 'googleTrends');
  
  if (!baseTrendsLayer) {
    console.log('Base Google Trends layer not found');
    return;
  }
  
  console.log('Found base Google Trends layer:', baseTrendsLayer.id);
  
  // Find all virtual trend layers
  const virtualTrendsLayers = allLayers.filter(layer => 
    layer.id && layer.id.startsWith('googleTrends-')
  );
  
  console.log(`Found ${virtualTrendsLayers.length} virtual trend layers`);
  
  if (virtualTrendsLayers.length === 0) {
    console.log('No virtual trend layers found');
    return;
  }
  
  // Fix the base layer first
  if (baseTrendsLayer.type === 'feature') {
    console.log('Fixing base Google Trends layer');
    
    // Make sure it has no restrictive definition expression
    if (baseTrendsLayer.definitionExpression === '1=0') {
      console.log('- Removing restrictive definition expression');
      baseTrendsLayer.definitionExpression = '';
    }
    
    // Keep it invisible but loaded
    baseTrendsLayer.visible = false;
    baseTrendsLayer.opacity = 0.01;
    
    // Force a refresh
    if (typeof baseTrendsLayer.refresh === 'function') {
      baseTrendsLayer.refresh();
    }
    
    // Get data directly to verify it has features
    const query = baseTrendsLayer.createQuery();
    query.where = '1=1';
    query.returnCountOnly = true;
    
    baseTrendsLayer.queryFeatureCount(query).then(count => {
      console.log(`Base layer has ${count} features`);
      
      if (count === 0) {
        console.log('WARNING: Base layer has no features - virtual layers will not display!');
      } else {
        console.log('Base layer has features - virtual layers should be able to display');
      }
    }).catch(error => {
      console.error('Error querying base layer:', error);
    });
  }
  
  // Get a feature from the base layer to identify fields
  const baseQuery = baseTrendsLayer.createQuery();
  baseQuery.where = '1=1';
  baseQuery.num = 1;
  baseQuery.outFields = ['*'];
  
  baseTrendsLayer.queryFeatures(baseQuery).then(result => {
    if (result.features.length === 0) {
      console.error('No features found in base layer');
      return;
    }
    
    const attributes = result.features[0].attributes;
    console.log('Available fields in base layer:', Object.keys(attributes));
    
    // Fix each virtual layer with a proper renderer
    virtualTrendsLayers.forEach(async virtualLayer => {
      if (virtualLayer.type !== 'feature') return;
      
      const fieldName = virtualLayer.id.replace('googleTrends-', '');
      console.log(`Fixing virtual layer: ${virtualLayer.id}, Field: ${fieldName}`);
      
      // Check if the field exists in the base layer
      if (!(fieldName in attributes)) {
        console.warn(`WARNING: Field "${fieldName}" not found in base layer attributes!`);
      }
      
      // Always make sure virtual layer is visible
      virtualLayer.visible = true;
      virtualLayer.opacity = 1.0;
      
      // Remove any restrictive definition expression
      if (virtualLayer.definitionExpression === '1=0') {
        virtualLayer.definitionExpression = '';
      }
      
      try {
        // Create a proper class breaks renderer for this field
        const renderer = {
          type: 'class-breaks',
          field: fieldName,
          classBreakInfos: [
            {
              minValue: 0,
              maxValue: 25,
              symbol: {
                type: 'simple-fill',
                color: [255, 255, 178, 0.8],
                outline: {
                  color: [128, 128, 128, 0.5],
                  width: 0.5
                }
              }
            },
            {
              minValue: 25,
              maxValue: 50,
              symbol: {
                type: 'simple-fill',
                color: [254, 204, 92, 0.8],
                outline: {
                  color: [128, 128, 128, 0.5],
                  width: 0.5
                }
              }
            },
            {
              minValue: 50,
              maxValue: 75,
              symbol: {
                type: 'simple-fill',
                color: [253, 141, 60, 0.8],
                outline: {
                  color: [128, 128, 128, 0.5],
                  width: 0.5
                }
              }
            },
            {
              minValue: 75,
              maxValue: 100,
              symbol: {
                type: 'simple-fill',
                color: [240, 59, 32, 0.8],
                outline: {
                  color: [128, 128, 128, 0.5],
                  width: 0.5
                }
              }
            }
          ]
        };
        
        // Apply the renderer to the virtual layer
        virtualLayer.renderer = renderer;
        console.log(`Applied custom renderer to ${virtualLayer.id}`);
        
        // Force a refresh of the layer
        if (typeof virtualLayer.refresh === 'function') {
          virtualLayer.refresh();
        }
        
        // Check if the layer has features with this field
        const query = virtualLayer.createQuery();
        query.where = `${fieldName} IS NOT NULL`;
        query.returnCountOnly = true;
        
        virtualLayer.queryFeatureCount(query).then(count => {
          console.log(`Layer ${virtualLayer.id} has ${count} features with non-null ${fieldName} values`);
        }).catch(error => {
          console.warn(`Error querying ${virtualLayer.id}:`, error);
        });
      } catch (error) {
        console.error(`Error applying renderer to ${virtualLayer.id}:`, error);
      }
    });
  }).catch(error => {
    console.error('Error querying base layer:', error);
  });
  
  console.log('Fix script completed. Try toggling the layers now.');
})();
