# Dynamic Layer System Integration

This folder contains reference implementations showing how to integrate the dynamic layer system with the geospatial-chat-interface component. 

## Overview

The dynamic layer system provides a more flexible and maintainable approach to configuring, querying, and visualizing geospatial layers. It decouples the layer configuration from visualization logic and provides a registry system for managing layer metadata.

## Files

- `dynamic-layers.ts`: Core registry system and layer provider interfaces
- `DynamicVisualizationFactory.ts`: Factory that creates visualizations using the registry
- `geospatial-chat-interface-integration.ts`: Example of how to integrate with the main component

## Integration Steps

### 1. Add the New Files

First, copy the implementation files to their respective locations:

```bash
cp reference/dynamic-layers.ts config/
cp reference/DynamicVisualizationFactory.ts lib/
```

### 2. Update Imports

In `components/geospatial-chat-interface.tsx`, add these imports:

```typescript
import { DynamicVisualizationFactory } from '../lib/DynamicVisualizationFactory';
import { 
  layerRegistry, 
  VisualizationType, 
  initializeLayerRegistry 
} from '../config/dynamic-layers';
```

### 3. Update Factory Initialization

Update the `initFactory` function to initialize the dynamic layer system:

```typescript
const initFactory = async () => {
  try {
    if (!factoryRef.current && mapView && mapView.ready) {
      console.log('Initializing visualization factory with map view');
      const factory = new DynamicVisualizationFactory();
      await factory.initialize(mapView);
      factoryRef.current = factory;
      
      // Initialize layer registry with existing configs
      await initializeLayerRegistry(layerConfigsObject);
      
      console.log('Factory and registry initialized successfully');
    }
  } catch (e) {
    console.error('Error initializing visualization factory:', e);
  }
};
```

### 4. Update handleVisualization

Replace the `handleVisualization` function with the implementation shown in the integration reference file. Key changes include:

- Using the factory to create visualizations based on analysis type
- Preparing visualization options from analysis results
- Handling factory initialization if needed

### 5. Update handleTrendsQuery

Replace the `handleTrendsQuery` function to use the dynamic factory, as shown in the integration reference.

### 6. Update Types

Ensure any custom types are properly imported or defined:

```typescript
import { VisualizationOptions } from '../config/dynamic-layers';
```

## Benefits of the Integration

1. **More Dynamic Visualization Creation**: The system can suggest appropriate visualization types based on the query and layer metadata.

2. **Better Code Organization**: Layer configuration is separate from visualization logic, making it easier to maintain.

3. **Extensibility**: New visualization types or layer providers can be added without modifying the main component.

4. **Better Error Handling**: The factory provides consistent error handling and fallbacks.

5. **Support for Different Layer Types**: The provider system makes it easier to work with different layer sources (feature services, GeoJSON, virtual layers).

## Next Steps

1. **Test Integration**: Start with a small part of the integration (just the imports and factory initialization) and verify it works.

2. **Progressive Implementation**: Gradually replace visualization logic with the new factory system.

3. **Add More Visualization Types**: Extend the system with additional visualization types as needed.

4. **Enhance Pattern Matching**: Improve the query-to-visualization pattern matching for better suggestions.

5. **Documentation**: Document the new layer configuration approach for developers.

## Best Practices

- Keep backward compatibility where possible
- Log important steps during initialization and visualization creation for debugging
- Add appropriate error handling and fallbacks
- Use consistent naming conventions across the system 