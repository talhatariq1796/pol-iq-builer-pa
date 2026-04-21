/**
 * Google Trends Layer Debug Script
 * Copy and paste this entire file into your browser's developer console
 * when viewing the application to debug and fix Google Trends layers.
 */

(function() {
  console.log('=== GOOGLE TRENDS LAYER DEBUG SCRIPT ===');
  console.log('Running diagnostics on map and layers...');
  
  // Try to find the map view instance
  let mapView = null;
  
  // Method 1: Check for global map instance
  if (window.mapView) {
    console.log('Found global mapView object');
    mapView = window.mapView;
  } else {
    console.log('No global mapView found, searching in React components...');
    
    // Method 2: Search for mapView in React instance
    const findMapViewInReact = () => {
      try {
        // Get all React instance root nodes
        const reactRoots = Array.from(document.querySelectorAll('[data-reactroot]'));
        console.log(`Found ${reactRoots.length} React roots to search`);
        
        // Find React component instances
        const findReactInstance = (element) => {
          const key = Object.keys(element).find(key => 
            key.startsWith('__reactFiber$') || 
            key.startsWith('__reactInternalInstance$')
          );
          return key ? element[key] : null;
        };
        
        // Loop through all React roots
        for (const root of reactRoots) {
          const instance = findReactInstance(root);
          if (instance) {
            // Search for mapView in the component tree
            const searchForMapView = (fiber) => {
              if (!fiber) return null;
              
              // Check if this component has a mapView property
              const stateNode = fiber.stateNode;
              if (stateNode && stateNode.mapView) {
                console.log('Found mapView in React component!');
                return stateNode.mapView;
              }
              
              // Check component's state
              if (stateNode && stateNode.state && stateNode.state.mapView) {
                console.log('Found mapView in component state!');
                return stateNode.state.mapView;
              }
              
              // Check component's props
              if (fiber.memoizedProps && fiber.memoizedProps.mapView) {
                console.log('Found mapView in component props!');
                return fiber.memoizedProps.mapView;
              }
              
              // Recursively search child components
              let view = null;
              if (fiber.child) {
                view = searchForMapView(fiber.child);
                if (view) return view;
              }
              
              // Check sibling components
              if (fiber.sibling) {
                view = searchForMapView(fiber.sibling);
                if (view) return view;
              }
              
              return null;
            };
            
            const view = searchForMapView(instance);
            if (view) {
              return view;
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Error searching for mapView in React:', error);
        return null;
      }
    };
    
    mapView = findMapViewInReact();
  }
  
  if (!mapView) {
    console.error('Could not find mapView. Please make sure the map is initialized.');
    return;
  }
  
  console.log(`Found mapView! ID: ${mapView.id || 'unknown'}, Type: ${mapView.type || 'unknown'}`);
  
  // Step 1: List all layers in the map
  const allLayers = mapView.map?.allLayers?.toArray() || [];
  console.log(`Total layers in map: ${allLayers.length}`);
  
  const layerInfo = allLayers.map(layer => ({
    id: layer.id || 'unknown',
    title: layer.title || 'untitled',
    type: layer.type || 'unknown',
    visible: !!layer.visible,
    opacity: layer.opacity || 0,
    hasRenderer: !!(layer.renderer),
    definitionExpression: layer.type === 'feature' ? (layer.definitionExpression || 'none') : 'n/a'
  }));
  
  console.table(layerInfo);
  
  // Step 2: Find Google Trends layers specifically
  const trendsLayers = allLayers.filter(layer => 
    layer.id === 'googleTrends' || 
    layer.id?.startsWith('googleTrends-') || 
    (layer.title && layer.title.toLowerCase().includes('trends')) ||
    (layer.metadata?.tags && layer.metadata.tags.includes('trends'))
  );
  
  console.log(`Found ${trendsLayers.length} Google Trends related layers`);
  
  if (trendsLayers.length > 0) {
    const trendsInfo = trendsLayers.map(layer => ({
      id: layer.id || 'unknown',
      title: layer.title || 'untitled',
      type: layer.type || 'unknown',
      visible: !!layer.visible,
      opacity: layer.opacity || 0,
      hasRenderer: !!(layer.renderer),
      definitionExpression: layer.type === 'feature' ? (layer.definitionExpression || 'none') : 'n/a',
      layerViewStatus: 'unknown'
    }));
    
    console.table(trendsInfo);
    
    // Step 3: Check for the base layer and virtual layers
    const baseLayer = trendsLayers.find(l => l.id === 'googleTrends');
    console.log(`Base Google Trends layer ${baseLayer ? 'found' : 'not found'}`);
    
    if (baseLayer) {
      console.log('Base layer details:', {
        id: baseLayer.id,
        visible: baseLayer.visible, 
        definitionExpression: baseLayer.type === 'feature' ? (baseLayer.definitionExpression || 'none') : 'n/a'
      });
      
      if (baseLayer.type === 'feature' && baseLayer.definitionExpression === '1=0') {
        console.log('ISSUE FOUND: Base layer has restrictive definition expression "1=0"');
        console.log('Fixing base layer definition expression...');
        
        // Fix the base layer
        baseLayer.definitionExpression = '';
        baseLayer.visible = true;
        baseLayer.opacity = 0.01; // Almost invisible but still there
        
        if (typeof baseLayer.refresh === 'function') {
          baseLayer.refresh();
        }
        
        console.log('Base layer fixed!');
      }
    }
    
    // Step 4: Fix virtual layers
    const virtualLayers = trendsLayers.filter(l => l.id?.startsWith('googleTrends-'));
    console.log(`Found ${virtualLayers.length} virtual Google Trends layers`);
    
    virtualLayers.forEach(layer => {
      console.log(`Fixing virtual layer ${layer.id}...`);
      
      // Make sure the layer is visible
      layer.visible = true;
      layer.opacity = 1.0;
      
      // If it's a feature layer, check definition expression and fix if needed
      if (layer.type === 'feature') {
        if (layer.definitionExpression === '1=0') {
          console.log(`ISSUE FOUND: Layer ${layer.id} has restrictive definition expression "1=0"`);
          layer.definitionExpression = '';
        }
        
        // Force a refresh
        if (typeof layer.refresh === 'function') {
          layer.refresh();
        }
      }
      
      console.log(`Fixed virtual layer ${layer.id}`);
    });
    
    // Step 5: Check for layer views (additional diagnostics)
    virtualLayers.forEach(async layer => {
      try {
        const layerView = await mapView.whenLayerView(layer);
        console.log(`Layer view for ${layer.id} status:`, {
          suspended: layerView.suspended,
          updating: layerView.updating,
          visible: layerView.visible
        });
      } catch (error) {
        console.error(`Could not get layer view for ${layer.id}:`, error);
      }
    });
    
    console.log('All Google Trends layers have been fixed. They should now be visible when toggled on.');
  } else {
    console.log('No Google Trends layers found in the map.');
    
    // Check layer list for possible Google Trends config
    if (window.layers && window.layers.googleTrends) {
      console.log('Found Google Trends layer config but layer is not in map.');
      console.log('This indicates the layer was not properly initialized or was removed.');
    }
  }
  
  console.log('=== DEBUG SCRIPT COMPLETED ===');
  console.log('Try toggling Google Trends layers now to see if they display properly.');
  console.log('If issues persist, check the browser console for more detailed logs.');
})();
