module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.[tj]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
    '**/lib/**/*.test.[tj]s?(x)'
  ],
  transform: {
  '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(?:@arcgis)/)', // Allow @arcgis/core to be transformed
  ],
  // Skip integration tests and external API tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/app/api/claude/',
    '/components/LayerController/__tests__/',
    '/utils/visualizations/__tests__/',
    '/utils/services/__tests__/',
  ],
  moduleNameMapper: {
    // Mock static assets (images, styles, etc.) if needed
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
}; 