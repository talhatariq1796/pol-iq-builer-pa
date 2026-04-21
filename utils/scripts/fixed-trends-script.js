/**
 * Simple Google Trends Layer Fix Script (JS compatible)
 * Copy and paste this entire file into your browser console to fix the Google Trends layers
 */

(function() {
  console.log('=== GOOGLE TRENDS LAYER FIX SCRIPT ===');
  
  // Get the map view
  let mapView = null;
  
  // Try to get mapView from window global
  if (window.mapView) {
    console.log('Found mapView in window global');
    mapView = window.mapView;
  } else if (window.sceneView) {
    console.log('Found sceneView in window global');
    mapView = window.sceneView;
  } else {
    console.log('No map view found in window globals');
    
    // Try to find in map containers
    const mapContainers = document.querySelectorAll('.esri-view-surface');
    if (mapContainers && mapContainers.length > 0) {
      console.log('Found map container, trying to access view instance');
      
      // Many ESRI apps store the view instance on the container or nearby
      for (const container of mapContainers) {
        // Try common property patterns
        for (const key of ['__esri_view__', '_esriView', 'view', 'mapView']) {
          if (container[key]) {
            mapView = container[key];
            console.log(`Found view in container.${key}`);
            break;
          }
        }
        
        if (mapView) break;
      }
    }
  }
  
  if (!mapView) {
    console.error('Could not find map view. Please make sure the map is loaded.');
    return;
  }
  
  console.log(`Found map view (${mapView.type})`);
  
  // Set up basic options for the renderer
  const getClassBreaksRenderer = (fieldName) => {
    return {
      type: "class-breaks",
      field: fieldName,
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 25,
          symbol: {
            type: "simple-fill",
            color: [255, 255, 178, 0.8],
            outline: {
              color: [128, 128, 128, 0.5],
              width: 0.5
            }
          },
          label: "Low"
        },
        {
          minValue: 25,
          maxValue: 50,
          symbol: {
            type: "simple-fill",
            color: [254, 204, 92, 0.8],
            outline: {
              color: [128, 128, 128, 0.5],
              width: 0.5
            }
          },
          label: "Medium-Low"
        },
        {
          minValue: 50,
          maxValue: 75,
          symbol: {
            type: "simple-fill",
            color: [253, 141, 60, 0.8],
            outline: {
              color: [128, 128, 128, 0.5],
              width: 0.5
            }
          },
          label: "Medium-High"
        },
        {
          minValue: 75,
          maxValue: 100,
          symbol: {
            type: "simple-fill",
            color: [240, 59, 32, 0.8],
            outline: {
              color: [128, 128, 128, 0.5],
              width: 0.5
            }
          },
          label: "High"
        }
      ]
    };
  };

  // STEP 1: Find all layers in the map
  if (!mapView.map) {
    console.error('Map not found in view');
    return;
  }
  
  const allLayers = mapView.map.allLayers.toArray();
  console.log(`Found ${allLayers.length} layers in map`);
  
  // STEP 2: Find Google Trends base layer
  const baseTrendsLayer = allLayers.find(function(layer) {
    return layer.id === 'googleTrends';
  });
  
  if (!baseTrendsLayer) {
    console.error('Could not find Google Trends base layer');
    return;
  }
  
  console.log(`Found Google Trends base layer: ${baseTrendsLayer.id} (Type: ${baseTrendsLayer.type})`);
  
  // STEP 3: Configure base layer properly
  if (baseTrendsLayer.type === 'feature') {
    console.log('Configuring base Google Trends layer...');
    
    // Keep the base layer hidden
    baseTrendsLayer.visible = false;
    baseTrendsLayer.opacity = 0.01;
    
    // Remove any restrictive definition expression
    if (baseTrendsLayer.definitionExpression === '1=0') {
      console.log('Removing restrictive definition expression from base layer');
      baseTrendsLayer.definitionExpression = '';
    }
    
    // Force a refresh to ensure changes take effect
    if (typeof baseTrendsLayer.refresh === 'function') {
      baseTrendsLayer.refresh();
    }
    
    console.log('Base layer configured: hidden but active');
  }
  
  // STEP 4: Find and fix the virtual layers
  const virtualLayers = allLayers.filter(function(layer) {
    return layer.id && layer.id.startsWith('googleTrends-');
  });
  
  console.log(`Found ${virtualLayers.length} Google Trends virtual layers`);
  
  if (virtualLayers.length === 0) {
    console.log('No virtual layers found. They may not have been created yet.');
    return;
  }
  
  // Fix each virtual layer
  virtualLayers.forEach(function(layer) {
    if (layer.type !== 'feature') return;
    
    console.log(`\nFixing virtual layer: ${layer.id}`);
    
    // Extract the field name from the layer ID
    const fieldName = layer.id.replace('googleTrends-', '');
    console.log(`- Field name: ${fieldName}`);
    
    try {
      // Set layer to visible
      layer.visible = true;
      layer.opacity = 1.0;
      
      // Remove any restrictive definition expression
      if (layer.definitionExpression === '1=0') {
        console.log(`- Removing restrictive definition expression`);
        layer.definitionExpression = '';
      }
      
      // Create a proper renderer for this field
      console.log(`- Applying class breaks renderer for field: ${fieldName}`);
      layer.renderer = getClassBreaksRenderer(fieldName);
      
      // Refresh the layer to apply changes
      if (typeof layer.refresh === 'function') {
        console.log(`- Refreshing layer`);
        layer.refresh();
      }
    } catch (error) {
      console.error(`Error fixing layer ${layer.id}:`, error);
    }
  });
  
  // STEP 5: Set up a watcher to fix any layers that are toggled
  console.log('\nSetting up watcher for layer visibility changes...');
  
  virtualLayers.forEach(function(layer) {
    if (layer.type !== 'feature') return;
    
    const fieldName = layer.id.replace('googleTrends-', '');
    
    layer.watch('visible', function(newValue) {
      console.log(`Layer ${layer.id} visibility changed to ${newValue}`);
      
      if (newValue === true) {
        console.log(`Ensuring ${layer.id} has proper renderer`);
        
        // Make sure renderer is still properly applied
        layer.renderer = getClassBreaksRenderer(fieldName);
        
        // Refresh the layer
        if (typeof layer.refresh === 'function') {
          layer.refresh();
        }
      }
    });
  });
  
  console.log('\nGoogle Trends layers fix complete!');
  console.log('Try toggling the Google Trends layers now - they should display properly.');
})();
