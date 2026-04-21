import { LayerStylingConfig } from '../types';

/**
 * Styling Presets - Pre-configured styling configurations for different use cases
 * 
 * Provides:
 * - Default styling for basic layers
 * - Premium styling with advanced effects
 * - Analysis-specific styling (correlation, hotspot, cluster, etc.)
 * - Consistent visual themes across the application
 */
export const stylingPresets: Record<string, LayerStylingConfig> = {
  'default': {
    baseStyle: {
      color: '#3388ff',
      opacity: 0.8,
      outline: { color: 'transparent', width: 0 }
    }
  },
  
  'premium': {
    baseStyle: {
      color: '#ffd700',
      opacity: 0.9,
      outline: { color: 'transparent', width: 0 }
    },
    fireflyEffects: {
      enabled: true,
      intensity: 0.7,
      color: '#ffd700',
      particleSize: 3,
      glowRadius: 6,
      orbitSpeed: 0.02,
      pulseSpeed: 0.05,
      maxParticles: 50,
      triggerThreshold: 75,
      fadeDistance: 100
    },
    gradientEffects: {
      gradient: {
        type: 'radial',
        colors: ['#ffd700', '#ff6b35'],
        animated: true,
        animationSpeed: 0.01
      },
      border: {
        enabled: true,
        style: 'glow',
        width: 2,
        color: '#ffffff',
        animated: true,
        animationSpeed: 0.02
      },
      opacity: 0.8,
      hoverEffects: true
    },
    hoverEffects: {
      enabled: true,
      scale: 1.2,
      duration: 300,
      easing: 'ease-out',
      ripple: {
        enabled: true,
        color: '#ffd700',
        maxRadius: 50,
        duration: 800,
        opacity: 0.4
      },
      glow: { 
        enabled: true, 
        color: '#ffffff', 
        size: 8,
        intensity: 0.8
      },
      colorShift: {
        enabled: true,
        hoverColor: '#ff6b35',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 4,
        offsetX: 2,
        offsetY: 2
      }
    },
    ambientEffects: {
      enabled: true,
      density: 0.3,
      maxParticles: 150,
      minSize: 1,
      maxSize: 3,
      speed: 0.3,
      opacity: 0.4,
      colors: ['#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC'],
      types: ['dot', 'sparkle', 'star'],
      lifespan: 15000,
      fadeDistance: 50,
      interactiveResponse: true
    },
    visualEffects: {
      bloom: {
        enabled: true,
        intensity: 0.5,
        radius: 4,
        threshold: 0.8
      },
      glow: {
        enabled: true,
        color: '#ffd700',
        size: 6,
        intensity: 0.6,
        blur: 2
      },
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 3,
        offsetX: 1,
        offsetY: 1,
        opacity: 0.3
      }
    },
    animations: {
      entry: {
        type: 'fade-in',
        duration: 500,
        delay: 0,
        easing: 'ease-out'
      },
      continuous: {
        pulse: { 
          enabled: true, 
          duration: 2000, 
          scale: 1.1,
          easing: 'ease-in-out'
        },
        glow: {
          enabled: true,
          duration: 3000,
          intensity: 0.8,
          color: '#ffd700'
        }
      },
      interaction: {
        hover: {
          enabled: true,
          scale: 1.2,
          duration: 300,
          easing: 'ease-out'
        },
        click: {
          enabled: true,
          ripple: true,
          scale: 0.95,
          duration: 150
        },
        selection: {
          enabled: true,
          highlight: true,
          glow: true,
          duration: 200
        }
      }
    }
  },
  
  'correlation': {
    baseStyle: {
      color: '#e74c3c',
      opacity: 0.8
    },
    gradientEffects: {
      gradient: {
        type: 'linear',
        colors: ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#3498db'],
        animated: true,
        animationType: 'shift',
        direction: 45
      },
      border: {
        enabled: true,
        style: 'solid',
        width: 1.5,
        color: '#ffffff',
        animated: false
      },
      opacity: 0.8,
      hoverEffects: true
    },
    hoverEffects: {
      enabled: true,
      scale: 1.1,
      duration: 300,
      easing: 'ease-out',
      ripple: { 
        enabled: true, 
        color: '#e74c3c',
        maxRadius: 40,
        duration: 600,
        opacity: 0.5
      },
      glow: { 
        enabled: true, 
        color: '#e74c3c', 
        size: 6,
        intensity: 0.7
      },
      colorShift: {
        enabled: false,
        hoverColor: '#e74c3c',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: false,
        color: '#000000',
        blur: 2,
        offsetX: 1,
        offsetY: 1
      }
    },
    visualEffects: {
      bloom: {
        enabled: true,
        intensity: 0.3,
        radius: 3,
        threshold: 0.7
      }
    },
    animations: {
      entry: {
        type: 'scale-up',
        duration: 400,
        easing: 'ease-out'
      },
      continuous: {
        wave: {
          enabled: true,
          duration: 3000,
          amplitude: 0.1,
          frequency: 2
        }
      }
    }
  },
  
  'hotspot': {
    baseStyle: {
      color: '#e74c3c',
      opacity: 0.9
    },
    fireflyEffects: {
      enabled: true,
      intensity: 0.8,
      color: '#e74c3c',
      particleSize: 4,
      glowRadius: 8,
      orbitSpeed: 0.03,
      pulseSpeed: 0.06,
      maxParticles: 75,
      triggerThreshold: 60,
      fadeDistance: 120
    },
    visualEffects: {
      bloom: {
        enabled: true,
        intensity: 0.6,
        radius: 5,
        threshold: 0.6
      },
      glow: {
        enabled: true,
        color: '#e74c3c',
        size: 8,
        intensity: 0.8,
        blur: 3
      }
    },
    animations: {
      entry: {
        type: 'bounce',
        duration: 600,
        easing: 'ease-out'
      },
      continuous: {
        pulse: { 
          enabled: true, 
          duration: 2000, 
          scale: 1.3,
          easing: 'ease-in-out'
        }
      },
      interaction: {
        hover: {
          enabled: true,
          scale: 1.4,
          duration: 200,
          easing: 'ease-out'
        },
        click: {
          enabled: true,
          ripple: true,
          scale: 0.9,
          duration: 100
        }
      }
    }
  },
  
  'cluster': {
    baseStyle: {
      color: '#9b59b6',
      opacity: 0.8
    },
    gradientEffects: {
      gradient: {
        type: 'radial',
        colors: ['#9b59b6', '#8e44ad'],
        animated: true,
        animationType: 'pulse',
        centerX: 0.5,
        centerY: 0.5
      },
      border: {
        enabled: true,
        style: 'glow',
        width: 2,
        color: '#ffffff',
        animated: true,
        animationSpeed: 0.03,
        glowSize: 4
      },
      opacity: 0.8,
      hoverEffects: true
    },
    hoverEffects: {
      enabled: true,
      scale: 1.3,
      duration: 300,
      easing: 'ease-out',
      ripple: { 
        enabled: false, 
        color: '#9b59b6',
        maxRadius: 40,
        duration: 600,
        opacity: 0.4
      },
      glow: { 
        enabled: true, 
        color: '#9b59b6', 
        size: 12,
        intensity: 0.9
      },
      colorShift: {
        enabled: false,
        hoverColor: '#9b59b6',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 6,
        offsetX: 3,
        offsetY: 3
      }
    },
    visualEffects: {
      bloom: {
        enabled: true,
        intensity: 0.4,
        radius: 4,
        threshold: 0.7
      },
      glow: {
        enabled: true,
        color: '#9b59b6',
        size: 10,
        intensity: 0.7,
        blur: 4
      }
    },
    animations: {
      entry: {
        type: 'bounce',
        duration: 800,
        easing: 'ease-out'
      },
      continuous: {
        rotation: {
          enabled: true,
          speed: 0.5,
          direction: 'clockwise'
        }
      }
    }
  },
  
  'trend': {
    baseStyle: {
      color: '#3498db',
      opacity: 0.8
    },
    gradientEffects: {
      gradient: {
        type: 'linear',
        colors: ['#3498db', '#2980b9', '#1abc9c'],
        animated: true,
        animationType: 'shift',
        direction: 90
      },
      border: {
        enabled: true,
        style: 'dashed',
        width: 1,
        color: '#ffffff',
        animated: true,
        animationSpeed: 0.05,
        dashPattern: [5, 5]
      }
    },
    hoverEffects: {
      enabled: true,
      scale: 1.1,
      duration: 250,
      easing: 'ease-out',
      ripple: { 
        enabled: true, 
        color: '#3498db',
        maxRadius: 30,
        duration: 500,
        opacity: 0.4
      },
      glow: { 
        enabled: false, 
        color: '#3498db', 
        size: 6,
        intensity: 0.7
      },
      colorShift: {
        enabled: false,
        hoverColor: '#3498db',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: false,
        color: '#000000',
        blur: 2,
        offsetX: 1,
        offsetY: 1
      }
    },
    animations: {
      entry: {
        type: 'slide-in',
        duration: 600,
        easing: 'ease-out'
      },
      continuous: {
        wave: {
          enabled: true,
          duration: 4000,
          amplitude: 0.05,
          frequency: 1.5
        }
      }
    }
  },
  
  'outlier': {
    baseStyle: {
      color: '#e67e22',
      opacity: 0.9
    },
    fireflyEffects: {
      enabled: true,
      intensity: 0.9,
      color: '#e67e22',
      particleSize: 5,
      glowRadius: 10,
      orbitSpeed: 0.04,
      pulseSpeed: 0.08,
      maxParticles: 100,
      triggerThreshold: 50,
      fadeDistance: 150
    },
    visualEffects: {
      bloom: {
        enabled: true,
        intensity: 0.7,
        radius: 6,
        threshold: 0.5
      },
      glow: {
        enabled: true,
        color: '#e67e22',
        size: 12,
        intensity: 0.9,
        blur: 5
      }
    },
    animations: {
      entry: {
        type: 'bounce',
        duration: 700,
        easing: 'ease-out'
      },
      continuous: {
        pulse: { 
          enabled: true, 
          duration: 1500, 
          scale: 1.4,
          easing: 'ease-in-out'
        },
        rotation: {
          enabled: true,
          speed: 1,
          direction: 'clockwise'
        }
      }
    }
  },
  
  'comparison': {
    baseStyle: {
      color: '#34495e',
      opacity: 0.8
    },
    gradientEffects: {
      gradient: {
        type: 'conic',
        colors: ['#34495e', '#95a5a6', '#ecf0f1', '#bdc3c7'],
        animated: true,
        animationType: 'rotate',
        centerX: 0.5,
        centerY: 0.5
      },
      border: {
        enabled: true,
        style: 'solid',
        width: 2,
        color: '#2c3e50',
        animated: false
      }
    },
    hoverEffects: {
      enabled: true,
      scale: 1.15,
      duration: 300,
      easing: 'ease-out',
      ripple: { 
        enabled: false, 
        color: '#34495e',
        maxRadius: 30,
        duration: 500,
        opacity: 0.4
      },
      glow: { 
        enabled: true, 
        color: '#34495e', 
        size: 8,
        intensity: 0.6
      },
      colorShift: {
        enabled: false,
        hoverColor: '#34495e',
        blendMode: 'overlay'
      },
      shadow: {
        enabled: false,
        color: '#000000',
        blur: 2,
        offsetX: 1,
        offsetY: 1
      }
    },
    animations: {
      entry: {
        type: 'fade-in',
        duration: 500,
        easing: 'ease-out'
      },
      continuous: {
        glow: {
          enabled: true,
          duration: 2500,
          intensity: 0.7,
          color: '#34495e'
        }
      }
    }
  }
};

/**
 * Get a preset by name
 */
export function getStylingPreset(name: string): LayerStylingConfig {
  const preset = stylingPresets[name];
  if (!preset) {
    console.warn(`[StylingPresets] Preset "${name}" not found, using default`);
    return stylingPresets.default;
  }
  return preset;
}

/**
 * Get all available preset names
 */
export function getAvailablePresets(): string[] {
  return Object.keys(stylingPresets);
}

/**
 * Create a custom preset by merging with a base preset
 */
export function createCustomPreset(
  basePresetName: string, 
  overrides: Partial<LayerStylingConfig>
): LayerStylingConfig {
  const basePreset = getStylingPreset(basePresetName);
  return mergeStylingConfigs(basePreset, overrides);
}

/**
 * Merge two styling configurations
 */
export function mergeStylingConfigs(
  base: LayerStylingConfig, 
  overrides: Partial<LayerStylingConfig>
): LayerStylingConfig {
  return {
    ...base,
    ...overrides,
    baseStyle: {
      ...base.baseStyle,
      ...overrides.baseStyle
    },
    fireflyEffects: overrides.fireflyEffects || base.fireflyEffects,
    gradientEffects: overrides.gradientEffects || base.gradientEffects,
    hoverEffects: overrides.hoverEffects || base.hoverEffects,
    ambientEffects: overrides.ambientEffects || base.ambientEffects,
    visualEffects: overrides.visualEffects || base.visualEffects,
    animations: overrides.animations || base.animations,
    performance: overrides.performance || base.performance
  };
}

/**
 * Validate a styling configuration
 */
export function validateStylingConfig(config: LayerStylingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required base style properties
  if (!config.baseStyle) {
    errors.push('baseStyle is required');
  } else {
    if (!config.baseStyle.color) {
      errors.push('baseStyle.color is required');
    }
    if (config.baseStyle.opacity !== undefined && (config.baseStyle.opacity < 0 || config.baseStyle.opacity > 1)) {
      errors.push('baseStyle.opacity must be between 0 and 1');
    }
  }

  // Check firefly effects configuration
  if (config.fireflyEffects) {
    if (config.fireflyEffects.intensity !== undefined && (config.fireflyEffects.intensity < 0 || config.fireflyEffects.intensity > 1)) {
      errors.push('fireflyEffects.intensity must be between 0 and 1');
    }
    if (config.fireflyEffects.maxParticles !== undefined && config.fireflyEffects.maxParticles < 0) {
      errors.push('fireflyEffects.maxParticles must be non-negative');
    }
  }

  // Check hover effects configuration
  if (config.hoverEffects) {
    if (config.hoverEffects.scale !== undefined && config.hoverEffects.scale <= 0) {
      errors.push('hoverEffects.scale must be positive');
    }
    if (config.hoverEffects.duration !== undefined && config.hoverEffects.duration < 0) {
      errors.push('hoverEffects.duration must be non-negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
} 