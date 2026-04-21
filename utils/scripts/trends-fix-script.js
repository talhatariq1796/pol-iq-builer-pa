/**
 * Enhanced fix script for Google Trends layers that addresses all common issues
 * Copy and paste this entire file into your browser console to run the debug+fix
 */

(function() {
  console.log('=== GOOGLE TRENDS LAYER COMPREHENSIVE FIX SCRIPT ===');
  
  // Try to find the map view instance
  let mapView = null;
  
  // Method 1: Check for global map instance
  if (window.mapView) {
    console.log('Found global mapView object');
    mapView = window.mapView;
  } else if (window.sceneView) {
    console.log('Found global sceneView object');
    mapView = window.sceneView;
  } else {
    console.log('No global view found, searching in React components...');
    
    // Method 2: Search for mapView in React instance
    try {
      // Get all React roots
      const reactRoots = Array.from(document.querySelectorAll('[data-reactroot]'));
      console.log(`Found ${reactRoots.length} React roots to search`);
      
      // Find React component instances
      for (const root of reactRoots) {
        // Find React fiber nodes
        const fiberKeys = Object.keys(root).filter(key => 
          key.startsWith('__reactFiber$') || 
          key.startsWith('__reactInternalInstance$')
        );
        
        if (fiberKeys.length > 0) {
          const fiberNode = root[fiberKeys[0]];
          
          // Recursive function to search for mapView
          const findMapView = (fiber) => {
            if (!fiber) return null;
            
            // Check if this component has mapView
            if (fiber.stateNode && fiber.stateNode.mapView) {
              console.log('Found mapView in React component!');
              return fiber.stateNode.mapView;
            }
            
            // Check component's state
            if (fiber.memoizedState && typeof fiber.memoizedState === 'object') {
              const stateKeys = Object.keys(fiber.memoizedState);
              for (const key of stateKeys) {
                const value = fiber.memoizedState[key];
                if (value && value.declaredClass && 
                   (value.declaredClass === 'esri.views.MapView' || 
                    value.declaredClass === 'esri.views.SceneView')) {
                  console.log('Found view in component state!');
                  return value;
                }
              }
            }
            
            // Search child fiber
            let result = null;
            if (fiber.child) {
              result = findMapView(fiber.child);
              if (result) return result;
            }
            
            // Search sibling fiber
            if (fiber.sibling) {
              result = findMapView(fiber.sibling);
              if (result) return result;
            }
            
            return null;
          };
          
          const view = findMapView(fiberNode);
          if (view) {
            mapView = view;
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error searching for mapView in React:', err);
    }
  }
  
  if (!mapView) {
    console.error('Could not find mapView. Please make sure the map is initialized.');
    return;
  }
  
  console.log(`Found view! Type: ${mapView.type}, ID: ${mapView.id || 'unknown'}`);
  
  // STEP 1: Identify and analyze all Google Trends layers
  const allLayers = mapView.map.allLayers.toArray();
  console.log(`Total map layers: ${allLayers.length}`);
  
  // Find all Google Trends related layers
  const trendsLayers = allLayers.filter(layer => 
    layer.id === 'googleTrends' || 
    layer.id?.startsWith('googleTrends-') || 
    (layer.title && layer.title.toLowerCase().includes('trends')) ||
    (layer.metadata?.tags && layer.metadata.tags.includes('trends'))
  );
  
  console.log(`Found ${trendsLayers.length} Google Trends related layers`);
  
  if (trendsLayers.length === 0) {
    console.log('No Google Trends layers found. Looking for base layers that might contain Google Trends data...');
    // No layers found, check if we need to create them
    return;
  }
  
  // Print layer details
  trendsLayers.forEach((layer, index) => {
    console.log(`\n[Layer ${index + 1}] ID: ${layer.id}, Title: ${layer.title || 'untitled'}`);
    console.log(`  Type: ${layer.type}, Visible: ${layer.visible}, Opacity: ${layer.opacity}`);
    
    if (layer.type === 'feature') {
      const featureLayer = layer;
      console.log(`  Definition Expression: ${featureLayer.definitionExpression || 'none'}`);
      console.log(`  Has Renderer: ${!!featureLayer.renderer}`);
      console.log(`  Layer View Status: ${mapView.layerViews.has(featureLayer) ? 'created' : 'not created'}`);
      
      // Check if it's a virtual layer
      const isVirtual = layer.id?.startsWith('googleTrends-') || 
                       (layer.metadata?.isVirtual === true);
      console.log(`  Is Virtual Layer: ${isVirtual}`);
      
      // For virtual layers, check if they have a source layer
      if (isVirtual) {
        console.log(`  Virtual layer source:`, 
          (layer.metadata?.sourceLayerId || 'unknown') + 
          (layer.metadata?.field ? ` (field: ${layer.metadata.field})` : '')
        );
      }
      
      // Check feature count
      if (featureLayer.queryFeatures) {
        const query = featureLayer.createQuery();
        query.where = "1=1";
        query.returnCountOnly = true;
        
        featureLayer.queryFeatures(query)
          .then(result => {
            console.log(`  Feature count: ${result.count}`);
            
            // If this is a base layer with features, request some sample features
            if (layer.id === 'googleTrends' && result.count > 0) {
              const sampleQuery = featureLayer.createQuery();
              sampleQuery.where = "1=1";
              sampleQuery.num = 5;
              sampleQuery.returnGeometry = true;
              sampleQuery.outFields = ["*"];
              
              return featureLayer.queryFeatures(sampleQuery);
            }
            return null;
          })
          .then(result => {
            if (result && result.features.length > 0) {
              console.log(`  Sample feature attributes:`, result.features[0].attributes);
              console.log(`  Sample feature has geometry: ${!!result.features[0].geometry}`);
              
              // Analyze fields that could contain trend data
              const attributes = result.features[0].attributes;
              const potentialTrendFields = [];
              
              for (const key in attributes) {
                const value = attributes[key];
                if (typeof value === 'number' && key !== 'OBJECTID' && !key.includes('_ID')) {
                  potentialTrendFields.push(key);
                }
              }
              
              if (potentialTrendFields.length > 0) {
                console.log(`  Potential trend data fields: ${potentialTrendFields.join(', ')}`);
              }
            }
          })
          .catch(err => {
            console.log(`  Error querying features: ${err.message}`);
          });
      }
    }
  });
  
  // STEP 2: Find and fix the base Google Trends layer
  const baseTrendsLayer = trendsLayers.find(layer => layer.id === 'googleTrends');
  
  if (baseTrendsLayer) {
    console.log('\n=== FIXING BASE GOOGLE TRENDS LAYER ===');
    
    // Ensure the layer is properly configured but keep it hidden
    if (baseTrendsLayer.type === 'feature') {
      const featureLayer = baseTrendsLayer;
      
      // Remove any restrictive definition expression
      if (featureLayer.definitionExpression === '1=0') {
        console.log('Removing restrictive definition expression (1=0) from base layer');
        featureLayer.definitionExpression = '';
      }
      
      // Keep base layer hidden (this is intentional - base layer should be invisible)
      featureLayer.visible = false; 
      
      // But set a very small opacity so it still renders (important!)
      featureLayer.opacity = 0.01;
      
      // Force a refresh
      if (typeof featureLayer.refresh === 'function') {
        console.log('Refreshing base layer');
        featureLayer.refresh();
      }
      
      console.log('Base layer configured: Hidden but active');
    }
  } else {
    console.log('No base GoogleTrends layer found');
  }
  
  // STEP 3: Fix all virtual Google Trends layers
  const virtualLayers = trendsLayers.filter(layer => 
    layer.id?.startsWith('googleTrends-') || 
    (layer.metadata?.isVirtual === true)
  );
  
  if (virtualLayers.length > 0) {
    console.log('\n=== FIXING VIRTUAL GOOGLE TRENDS LAYERS ===');
    
    virtualLayers.forEach(layer => {
      if (layer.type === 'feature') {
        const featureLayer = layer;
        const layerId = layer.id;
        
        console.log(`Fixing layer: ${layerId}`);
        
        // Remove any restrictive definition expression
        if (featureLayer.definitionExpression === '1=0') {
          console.log(` - Removing restrictive definition expression`);
          featureLayer.definitionExpression = '';
        }
        
        // Make layer visible
        console.log(` - Setting visible=true and opacity=1.0`);
        featureLayer.visible = true;
        featureLayer.opacity = 1.0;
        
        // Apply a renderer if it doesn't have one
        if (!featureLayer.renderer) {
          console.log(` - Layer missing renderer, applying default renderer`);
          
          // Extract field name from ID if possible
          let fieldName = 'thematic_value';
          if (layerId.startsWith('googleTrends-')) {
            fieldName = layerId.replace('googleTrends-', '');
            console.log(` - Using field name from ID: ${fieldName}`);
          }
          
          // Create a simple renderer
          featureLayer.renderer = {
            type: 'simple',
            symbol: {
              type: 'simple-fill',
              color: [255, 0, 0, 0.5],
              outline: {
                color: [255, 255, 0, 1],
                width: 2
              }
            }
          };
        }
        
        // Force a refresh
        if (typeof featureLayer.refresh === 'function') {
          featureLayer.refresh();
          console.log(` - Layer refreshed`);
        }
      }
    });
    
    console.log(`Fixed ${virtualLayers.length} virtual layers`);
  } else {
    console.log('No virtual Google Trends layers found');
    
    // If we have a base layer but no virtual layers, we might need to create them
    if (baseTrendsLayer && baseTrendsLayer.type === 'feature') {
      console.log('\n=== ATTEMPTING TO CREATE VIRTUAL LAYERS ===');
      
      // Query the base layer to find fields that might represent trend data
      const baseFeatureLayer = baseTrendsLayer;
      const query = baseFeatureLayer.createQuery();
      query.where = "1=1";
      query.num = 1;
      query.outFields = ["*"];
      
      baseFeatureLayer.queryFeatures(query)
        .then(result => {
          if (result.features.length > 0) {
            const attributes = result.features[0].attributes;
            const potentialTrendFields = [];
            
            // Find numeric fields that might contain trend data
            for (const key in attributes) {
              const value = attributes[key];
              if (typeof value === 'number' && 
                  key !== 'OBJECTID' && 
                  !key.includes('_ID') &&
                  !key.includes('FID') &&
                  !key.includes('SHAPE')) {
                potentialTrendFields.push(key);
              }
            }
            
            console.log(`Found ${potentialTrendFields.length} potential trend fields`);
            
            if (potentialTrendFields.length > 0) {
              console.log('Fields:', potentialTrendFields.join(', '));
              
              // We would create virtual layers here if we had access to the original creation code
              console.log('To create virtual layers, we need access to the layer creation code');
            }
          }
        })
        .catch(err => {
          console.error('Error querying base layer:', err);
        });
    }
  }
  
  // STEP 4: Check layer views for all trend layers
  console.log('\n=== CHECKING LAYER VIEWS ===');
  
  trendsLayers.forEach(async layer => {
    try {
      const layerView = await mapView.whenLayerView(layer);
      console.log(`Layer view for ${layer.id}:`, {
        suspended: layerView.suspended,
        updating: layerView.updating,
        visible: layerView.visible
      });
      
      // If the layer view is suspended, try to resume it
      if (layerView.suspended) {
        console.log(`Layer view for ${layer.id} is suspended, attempting to resume...`);
        // No direct API to unsuspend, but we can try to trigger an update
        if (layer.type === 'feature') {
          layer.refresh();
        }
      }
    } catch (error) {
      console.log(`Could not get layer view for ${layer.id}:`, error);
    }
  });
  
  // Step 5: Ensure future layers will be visible
  console.log('\n=== SETTING UP OBSERVER FOR FUTURE LAYERS ===');
  
  // Create an observer for the layers collection
  const layerObserver = mapView.map.allLayers.on('change', event => {
    if (event.added && event.added.length > 0) {
      for (const layer of event.added) {
        if (layer.id === 'googleTrends' || 
            layer.id?.startsWith('googleTrends-') || 
            (layer.title && layer.title.toLowerCase().includes('trends')) ||
            (layer.metadata?.tags && layer.metadata.tags.includes('trends'))) {
          
          console.log(`New trends layer detected: ${layer.id}`);
          
          // Handle base layer differently from virtual layers
          if (layer.id === 'googleTrends') {
            // Base layer should be hidden but active
            layer.visible = false;
            layer.opacity = 0.01;
            
            if (layer.type === 'feature' && layer.definitionExpression === '1=0') {
              layer.definitionExpression = '';
            }
          } else {
            // Virtual layers should be visible
            layer.visible = true;
            layer.opacity = 1.0;
            
            if (layer.type === 'feature' && layer.definitionExpression === '1=0') {
              layer.definitionExpression = '';
            }
          }
          
          // Force refresh if it's a feature layer
          if (layer.type === 'feature' && typeof layer.refresh === 'function') {
            layer.refresh();
          }
        }
      }
    }
  });
  
  console.log('Observer set up for layer changes. New Google Trends layers will be fixed automatically.');
  console.log('=== FIX SCRIPT COMPLETED ===');
})();
