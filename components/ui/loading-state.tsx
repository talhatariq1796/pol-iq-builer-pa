import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

type LoadingStateComponent = React.FC<LoadingStateProps> & {
  Map: React.FC;
  Analysis: React.FC<{ progress?: number }>;
  Visualization: React.FC;
  FilterSync: React.FC;
};

interface LoadingStateProps {
  type?: 'overlay' | 'inline' | 'skeleton';
  message?: string;
  progress?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSpinner?: boolean;
  steps?: {
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
  }[];
}

interface SkeletonProps {
  type: 'text' | 'card' | 'chart';
  lines?: number;
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ type, lines = 1, className = '' }) => {
  switch (type) {
    case 'text':
      return (
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-4 theme-skeleton rounded ${
                i === lines - 1 ? 'w-4/5' : 'w-full'
              } ${className}`}
            />
          ))}
        </div>
      );

    case 'card':
      return (
        <Card className={`p-4 space-y-4 ${className}`}>
          <div className="h-6 theme-skeleton rounded w-3/4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-4 theme-skeleton rounded"
                style={{ width: `${85 - i * 10}%` }}
              />
            ))}
          </div>
        </Card>
      );

    case 'chart':
      return (
        <div className={`w-full h-64 relative ${className}`}>
          <div className="absolute inset-0 theme-skeleton rounded" />
          <div className="absolute bottom-0 left-0 w-16 h-full theme-skeleton" />
          <div className="absolute bottom-0 left-16 right-0 h-8 theme-skeleton" />
          <div className="absolute inset-16 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full theme-skeleton" />
          </div>
        </div>
      );
  }
};

const LoadingStateBase: React.FC<LoadingStateProps> = ({
  type = 'inline',
  message = 'Loading...',
  progress,
  className = '',
  size = 'md',
  showSpinner = true,
  steps
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const containerClasses = {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
    inline: 'flex items-center justify-center p-4',
    skeleton: ''
  };

  if (type === 'skeleton') {
    return (
      <div className={`space-y-4 ${className}`}>
        <Skeleton type="card" />
        <Skeleton type="chart" />
        <Skeleton type="text" lines={3} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`${containerClasses[type]} ${className}`}
    >
      <Card className="theme-card rounded-lg theme-shadow-primary p-6">
        <div className="flex flex-col items-center space-y-4">
          {showSpinner && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className={`${sizeClasses[size]} theme-loading-spinner`} />
            </motion.div>
          )}
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="theme-text-secondary text-sm"
          >
            {message}
          </motion.p>

          {typeof progress === 'number' && (
            <div className="w-full max-w-xs">
              <div className="theme-progress-bar">
                <div 
                  className="theme-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-center mt-1"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                {Math.round(progress)}%
              </motion.p>
            </div>
          )}

          {steps && (
            <div className="w-full space-y-2 mt-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-2"
                >
                  <div className={`
                    w-5 h-5 rounded-full flex items-center justify-center
                    ${step.status === 'complete' ? 'bg-green-500' :
                      step.status === 'error' ? 'bg-red-500' :
                      step.status === 'processing' ? 'animate-pulse' : 
                      ''}
                  `}
                  style={{
                    backgroundColor: step.status === 'processing' ? 'var(--theme-accent-primary)' :
                                   step.status === 'pending' ? 'var(--theme-bg-tertiary)' :
                                   undefined
                  }}>
                    {step.status === 'complete' && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </motion.svg>
                    )}
                    {step.status === 'error' && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </motion.svg>
                    )}
                    {step.status === 'processing' && (
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    )}
                  </div>
                  <span className="text-sm theme-text-secondary">{step.label}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

const LoadingState = LoadingStateBase as LoadingStateComponent;

// Compound components for specific loading scenarios
const MapLoader = () => (
  <LoadingState
    type="overlay"
    message="Loading map data..."
    showSpinner={true}
    className="absolute inset-0 bg-gray-50/90"
  />
);

const AnalysisLoader = ({ progress }: { progress?: number }) => (
  <LoadingState
    type="overlay"
    message="Analyzing data..."
    progress={progress}
    className="absolute inset-0 bg-gray-50/90"
  />
);

const VisualizationLoader = () => (
  <LoadingState
    type="skeleton"
    className="rounded-lg overflow-hidden"
  />
);

const FilterSyncLoader = () => (
  <LoadingState
    type="inline"
    message="Synchronizing filters..."
    size="sm"
    className="h-8"
  />
);

// Add display names to compound components
MapLoader.displayName = 'LoadingState.Map';
AnalysisLoader.displayName = 'LoadingState.Analysis';
VisualizationLoader.displayName = 'LoadingState.Visualization';
FilterSyncLoader.displayName = 'LoadingState.FilterSync';

// Assign compound components
LoadingState.Map = MapLoader;
LoadingState.Analysis = AnalysisLoader;
LoadingState.Visualization = VisualizationLoader;
LoadingState.FilterSync = FilterSyncLoader;

export default LoadingState;