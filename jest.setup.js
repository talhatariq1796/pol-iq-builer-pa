// Mock @arcgis/core modules
jest.mock('@arcgis/core/layers/FeatureLayer', () => {
  return jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue({}),
    queryFeatures: jest.fn().mockResolvedValue({ features: [] }),
    createQuery: jest.fn().mockReturnValue({}),
    renderer: null,
    source: null,
    title: 'Mock Layer'
  }));
});

jest.mock('@arcgis/core/renderers/SimpleRenderer', () => {
  return jest.fn().mockImplementation(() => ({
    symbol: null
  }));
});

jest.mock('@arcgis/core/symbols/SimpleFillSymbol', () => {
  return jest.fn().mockImplementation(() => ({
    color: [0, 0, 0, 0.5]
  }));
});

jest.mock('@arcgis/core/renderers/ClassBreaksRenderer', () => {
  return jest.fn().mockImplementation(() => ({
    field: 'value',
    classBreakInfos: []
  }));
});

// Set test timeout
jest.setTimeout(10000); 