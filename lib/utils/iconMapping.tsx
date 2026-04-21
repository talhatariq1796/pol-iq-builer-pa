import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Search, 
  Rocket, 
  Lightbulb,
  Users,
  MapPin,
  Trophy,
  Activity,
  Zap,
  Brain
} from 'lucide-react';

export type IconType = 'emoji' | 'lucide' | 'modern-emoji';

interface IconConfig {
  emoji: string;
  modernEmoji: string;
  lucideIcon: React.ComponentType<{ className?: string }>;
  ariaLabel: string;
}

const iconMappings: Record<string, IconConfig> = {
  analyzing: {
    emoji: '📊',
    modernEmoji: '📈',
    lucideIcon: BarChart3,
    ariaLabel: 'Analyzing data'
  },
  statistics: {
    emoji: '📊',
    modernEmoji: '📈',
    lucideIcon: BarChart3,
    ariaLabel: 'Statistics'
  },
  distribution: {
    emoji: '📈',
    modernEmoji: '📊',
    lucideIcon: TrendingUp,
    ariaLabel: 'Distribution analysis'
  },
  patterns: {
    emoji: '🎯',
    modernEmoji: '🔍',
    lucideIcon: Target,
    ariaLabel: 'Key patterns'
  },
  insights: {
    emoji: '💡',
    modernEmoji: '✨',
    lucideIcon: Lightbulb,
    ariaLabel: 'Insights'
  },
  competitive: {
    emoji: '🏆',
    modernEmoji: '⚡',
    lucideIcon: Trophy,
    ariaLabel: 'Competitive analysis'
  },
  geographic: {
    emoji: '🗺️',
    modernEmoji: '📍',
    lucideIcon: MapPin,
    ariaLabel: 'Geographic analysis'
  },
  demographic: {
    emoji: '👥',
    modernEmoji: '👤',
    lucideIcon: Users,
    ariaLabel: 'Demographic analysis'
  },
  search: {
    emoji: '🔍',
    modernEmoji: '🔎',
    lucideIcon: Search,
    ariaLabel: 'Search and discovery'
  },
  performance: {
    emoji: '🚀',
    modernEmoji: '⚡',
    lucideIcon: Rocket,
    ariaLabel: 'Performance metrics'
  },
  activity: {
    emoji: '⚡',
    modernEmoji: '🔥',
    lucideIcon: Activity,
    ariaLabel: 'Activity analysis'
  },
  intelligence: {
    emoji: '🧠',
    modernEmoji: '🤖',
    lucideIcon: Brain,
    ariaLabel: 'AI analysis'
  }
};

// Configuration - can be changed easily
export const currentIconType: IconType = 'lucide'; // Change this to switch icon types

export function getIcon(
  iconKey: keyof typeof iconMappings, 
  iconType: IconType = currentIconType,
  className: string = 'inline w-4 h-4'
): React.ReactNode {
  const config = iconMappings[iconKey];
  if (!config) return iconKey; // fallback to original key if not found
  
  switch (iconType) {
    case 'emoji':
      return (
        <span role="img" aria-label={config.ariaLabel}>
          {config.emoji}
        </span>
      );
    case 'modern-emoji':
      return (
        <span role="img" aria-label={config.ariaLabel}>
          {config.modernEmoji}
        </span>
      );
    case 'lucide':
      const IconComponent = config.lucideIcon;
      return <IconComponent className={className} aria-label={config.ariaLabel} />;
    default:
      return config.modernEmoji;
  }
}

// Convenience function to get icon as string (for text-based contexts)
export function getIconString(
  iconKey: keyof typeof iconMappings,
  iconType: IconType = currentIconType
): string {
  const config = iconMappings[iconKey];
  if (!config) return iconKey;
  
  switch (iconType) {
    case 'emoji':
      return config.emoji;
    case 'modern-emoji':
      return config.modernEmoji;
    case 'lucide':
      return ''; // Lucide icons can't be represented as strings
    default:
      return config.modernEmoji;
  }
}

// Available icon types for configuration
export const iconTypeOptions = [
  { value: 'emoji' as IconType, label: 'Classic Emojis', description: 'Original emoji style (📊📈🎯)' },
  { value: 'modern-emoji' as IconType, label: 'Modern Emojis', description: 'Updated emoji selection (📈📊🔍)' },
  { value: 'lucide' as IconType, label: 'Lucide Icons', description: 'Professional icon set (matching UI)' }
] as const;