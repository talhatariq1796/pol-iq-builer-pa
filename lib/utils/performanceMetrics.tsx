import React from 'react';
import { MODEL_NAME_MAPPING } from '@/lib/analysis/utils/ModelAttributionMapping';

interface MetricBadgeProps {
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'gray';
}

const MetricBadge: React.FC<MetricBadgeProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800', 
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800'
  };

  if (value === undefined || value === null || value === '') return null;

  return (
    <span className={`${colorClasses[color]} text-xs px-2 py-1 rounded whitespace-nowrap`}>
      {label}: {value}
    </span>
  );
};

interface AnalysisMetadata {
  modelInfo?: {
    target_variable?: string;
    feature_count?: number;
    accuracy?: number;
    r2?: number;        // preferred normalized field in UI
    r2_score?: number;  // passthrough from service if present
    rmse?: number;
    mae?: number;
    silhouette_score?: number;
    n_clusters?: number;
    outlier_ratio?: number;
    contamination?: number;
    model_type?: string;
  };
  isMultiEndpoint?: boolean;
  endpointsUsed?: string[];
  dataPointCount?: number;
  executionTime?: number;
}

interface AnalysisResult {
  endpoint: string;
  metadata?: AnalysisMetadata;
  data?: {
  records?: unknown[];
  };
}

const formatPercent = (value: number, fractionDigits = 1) => `${(value * 100).toFixed(fractionDigits)}%`;
const formatNumber = (value: number, fractionDigits = 3) => value.toFixed(fractionDigits);
const toTitleCase = (s: string) => s.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

export const renderPerformanceMetrics = (
  analysisResult: AnalysisResult, 
  containerClass: string = 'flex flex-wrap gap-2'
): React.ReactNode => {
  const { endpoint, metadata } = analysisResult;
  if (!metadata) return null;

  // Multi-endpoint simple display
  if (metadata.isMultiEndpoint && metadata.endpointsUsed) {
    return (
      <div className={containerClass}>
        <MetricBadge label="Analysis Type" value="Multi-Endpoint Analysis" color="gray" />
        <MetricBadge label="Model Used" value={`${metadata.endpointsUsed.length} endpoints`} color="gray" />
      </div>
    );
  }

  const analysisType = toTitleCase(endpoint);
  const modelType = metadata.modelInfo?.model_type 
    || MODEL_NAME_MAPPING[endpoint.replace(/^\//, '')]
    || 'Model';

  // Prefer r2, fallback to r2_score
  const r2Raw = (metadata.modelInfo?.r2 ?? metadata.modelInfo?.r2_score);
  const rmseRaw = metadata.modelInfo?.rmse;
  const maeRaw = metadata.modelInfo?.mae;

  const metrics: React.ReactNode[] = [];
  metrics.push(<MetricBadge key="analysisType" label="Analysis Type" value={analysisType} color="gray" />);
  metrics.push(<MetricBadge key="model" label="Model Used" value={modelType} color="gray" />);

  if (typeof r2Raw === 'number' && isFinite(r2Raw)) {
    metrics.push(<MetricBadge key="r2" label="Model R² Score" value={formatPercent(r2Raw)} color="gray" />);
  }
  if (typeof rmseRaw === 'number' && isFinite(rmseRaw)) {
    metrics.push(<MetricBadge key="rmse" label="RMSE" value={formatNumber(rmseRaw)} color="gray" />);
  }
  if (typeof maeRaw === 'number' && isFinite(maeRaw)) {
    metrics.push(<MetricBadge key="mae" label="MAE" value={formatNumber(maeRaw)} color="gray" />);
  }

  // Add clustering extras when relevant
  if (['/spatial-clusters', '/clustering'].includes(endpoint)) {
    const sil = metadata.modelInfo?.silhouette_score;
    const k = metadata.modelInfo?.n_clusters;
    if (typeof sil === 'number' && isFinite(sil)) {
      metrics.push(<MetricBadge key="silhouette" label="Cluster Quality" value={sil.toFixed(2)} color="gray" />);
    }
    if (typeof k === 'number' && isFinite(k)) {
      metrics.push(<MetricBadge key="clusters" label="Clusters Found" value={k} color="gray" />);
    }
  }

  // Add anomaly extras when relevant
  if (['/anomaly-detection', '/outlier-detection'].includes(endpoint)) {
    const ratio = metadata.modelInfo?.outlier_ratio;
    const contamination = metadata.modelInfo?.contamination;
    if (typeof ratio === 'number' && isFinite(ratio)) {
      metrics.push(<MetricBadge key="outliers" label="Anomalies Detected" value={formatPercent(ratio)} color="gray" />);
    }
    if (typeof contamination === 'number' && isFinite(contamination)) {
      metrics.push(<MetricBadge key="contamination" label="Expected Rate" value={formatPercent(contamination)} color="gray" />);
    }
  }

  return metrics.length > 0 ? <div className={containerClass}>{metrics}</div> : null;
};

export default MetricBadge;