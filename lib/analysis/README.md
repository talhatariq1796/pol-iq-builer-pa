# AnalysisEngine System

## Overview

The AnalysisEngine is a unified system that replaces the chaotic collection of 13 different managers with a single, well-organized architecture for handling all analysis operations.

## Quick Start

### Basic Usage

```typescript
import { useAnalysisEngine } from '@/lib/analysis';

function MyAnalysisComponent() {
  const { executeAnalysis, isProcessing, currentAnalysis } = useAnalysisEngine();

  const handleQuery = async (query: string) => {
    const result = await executeAnalysis(query);
    console.log('Analysis result:', result);
  };

  return (
    <div>
      <button onClick={() => handleQuery('show me clusters')}>
        Analyze Clusters
      </button>
      {isProcessing && <div>Processing...</div>}
      {currentAnalysis && <div>Results: {currentAnalysis.records.length} records</div>}
    </div>
  );
}
```

### Advanced Usage with Options

```typescript
const result = await executeAnalysis('compare nike vs adidas', {
  endpoint: '/competitive-analysis',  // Force specific endpoint
  targetVariable: 'MP30034A_B_P',    // Override target variable
  sampleSize: 5000                   // Set sample size
});
```

## Available Endpoints

### Core Analysis
- `/analyze` - General analysis with rankings and insights
- `/correlation-analysis` - Analyze relationships between variables  
- `/anomaly-detection` - Identify unusual patterns or outliers
- `/threshold-analysis` - Analyze performance against thresholds
- `/feature-interactions` - Analyze feature interactions
- `/outlier-detection` - Detect statistical outliers
- `/comparative-analysis` - Compare multiple variables
- `/predictive-modeling` - Predictive analysis and forecasting

### Geographic Analysis
- `/spatial-clusters` - Find areas with similar characteristics

### Demographic Analysis  
- `/segment-profiling` - Profile demographic segments by area
- `/demographic-insights` - Deep demographic analysis

### Economic Analysis
- `/market-risk` - Assess market risk by area
- `/penetration-optimization` - Identify optimization opportunities
- `/scenario-analysis` - What-if scenario modeling

### Competitive Analysis
- `/competitive-analysis` - Compare brand performance across areas

### Temporal Analysis
- `/trend-analysis` - Analyze trends over time

## Smart Endpoint Routing

The system automatically selects appropriate endpoints based on query keywords:

```typescript
await executeAnalysis('show me clusters');        // → /spatial-clusters
await executeAnalysis('compare nike vs adidas');  // → /competitive-analysis  
await executeAnalysis('what are the risks');      // → /market-risk
await executeAnalysis('demographic trends');      // → /demographic-insights
```

## State Management

The AnalysisEngine provides centralized state management:

```typescript
const { state, subscribe } = useAnalysisEngine();

// Subscribe to state changes
useEffect(() => {
  const unsubscribe = subscribe((newState) => {
    console.log('State updated:', newState);
  });
  return unsubscribe;
}, []);

// Access specific state properties
const {
  isProcessing,
  currentStep,     // 'routing' | 'calling-endpoint' | 'processing-data' | etc.
  progress,        // 0-100
  hasError,
  errorMessage,
  lastQuery,
  currentAnalysis,
  currentVisualization,
  selectedEndpoint,
  history
} = useAnalysisEngine();
```

## Event System

Listen to analysis lifecycle events:

```typescript
const { addEventListener } = useAnalysisEngine();

useEffect(() => {
  const unsubscribe = addEventListener('analysis-completed', (event) => {
    console.log('Analysis completed:', event.payload);
  });
  return unsubscribe;
}, []);
```

Available events:
- `analysis-started`
- `analysis-completed` 
- `analysis-failed`
- `visualization-created`
- `state-updated`
- `endpoint-changed`

## Visualization System

The engine automatically creates appropriate visualizations for each endpoint:

```typescript
const result = await executeAnalysis(query);

// Visualization is automatically created based on endpoint
console.log('Visualization type:', result.visualization.type);
console.log('Renderer config:', result.visualization.config);
console.log('Legend:', result.visualization.legend);
```

## Error Handling

Comprehensive error handling with fallbacks:

```typescript
try {
  const result = await executeAnalysis(query);
  if (!result.success) {
    console.error('Analysis failed:', result.error);
  }
} catch (error) {
  console.error('System error:', error);
}

// Or use state-based error handling
const { hasError, errorMessage } = useAnalysisEngine();
if (hasError) {
  console.error('Current error:', errorMessage);
}
```

## Performance Features

- **<500ms endpoint selection** using keyword matching
- **Centralized state** reduces React re-renders
- **Type-safe operations** catch errors at compile time
- **Event-driven updates** for efficient state synchronization

## Module Access

For advanced usage, access individual modules:

```typescript
const { engine } = useAnalysisEngine();

// Access specific modules
const endpoints = engine.modules.configManager.getEndpointConfigurations();
const routerInstance = engine.modules.endpointRouter;
const processor = engine.modules.dataProcessor;
```

## Migration from Old System

### Before (Complex)
```typescript
// Old system required multiple managers and complex setup
const analysisResult = await analyzeQuery(query);
const microserviceRequest = buildMicroserviceRequest(analysisResult, query);
const response = await fetch('/data/microservice-export.json'); // Static!
// ... 100+ lines of complex visualization logic
```

### After (Simple)
```typescript
// New system - everything is handled automatically
const result = await executeAnalysis(query);
// ✅ Endpoint routing, ✅ API calls, ✅ Data processing, ✅ Visualization creation
```

## Architecture Benefits

- **Single Entry Point**: All analysis goes through `executeAnalysis()`
- **Clear Ownership**: Each module has specific responsibilities  
- **Predictable Flow**: Request → Route → Process → Visualize → Update State
- **Easy Testing**: Each module can be tested independently
- **Simple Extension**: Adding new endpoints is straightforward
- **Debuggable**: Clear data flow and single state source 