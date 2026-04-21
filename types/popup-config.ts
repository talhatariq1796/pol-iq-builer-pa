import { LayerFieldFormat } from './layers';
import { Symbol } from '@arcgis/core/symbols';
import Graphic from '@arcgis/core/Graphic';

/**
 * Geographic levels
 */
export enum GeographicLevel {
  NATIONAL = 'national',
  STATE = 'state',
  COUNTY = 'county',
  TRACT = 'tract',
  BLOCK_GROUP = 'block_group',
  CUSTOM = 'custom'
}

/**
 * Display mode for field data
 */
export type DisplayMode = 'list' | 'table' | 'custom';

/**
 * Field configuration for popup display
 */
export interface PopupField {
  fieldName?: string;
  label: string;
  visible?: boolean;
  decimals?: number;
  nullValue?: string;
  transform?: (value: any) => any;
  formatter?: (feature: Graphic) => React.ReactNode;
}

/**
 * Action button configuration for popups
 */
export interface PopupAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (feature: Graphic) => void;
}

/**
 * Main popup configuration
 */
export interface PopupConfig {
  title?: string | ((feature: Graphic) => string);
  fields?: PopupField[] | ((layer: __esri.FeatureLayer | null | undefined) => PopupField[]);
  actions?: PopupAction[];
  displayType?: DisplayMode;
  showCloseButton?: boolean;
  position?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  maxHeight?: number;
  maxWidth?: number;
  getFields?: (feature: Graphic) => PopupField[];
}

/**
 * Popup component props
 */
export interface PopupProps {
  feature: Graphic;
  config: PopupConfig;
  onClose?: () => void;
}

/**
 * Field display props
 */
export interface FieldDisplayProps {
  feature: Graphic;
  fields: PopupField[];
  displayType?: DisplayMode;
}

/* ArcGIS Native Popup Configuration Types */

/**
 * Base interface for all popup content elements
 */
export interface ContentElementBase {
  /** Optional arcade expression to control element visibility based on feature attributes */
  visibleExpression?: string;
  /** Optional ID for referencing this element */
  id?: string;
  /** Optional CSS classes to apply to the element */
  className?: string;
}

/**
 * Configuration for displaying feature fields in a list or table format
 */
export interface FieldsElement extends ContentElementBase {
  type: 'fields';
  /** How to display the fields: list (default) or table */
  displayType?: 'list' | 'table';
  /** Field configurations */
  fieldInfos: Array<{
    fieldName: string;
    label?: string;
    visible?: boolean;
    format?: LayerFieldFormat;
  }>;
}

/**
 * Configuration for rendering Arcade expression results
 */
export interface ArcadeElement extends ContentElementBase {
  type: 'arcade';
  /** Arcade expression string that generates HTML/text content */
  expression: string;
  /** Optional title for the section */
  title?: string;
}

/**
 * Configuration for rendering a chart based on feature attributes
 */
export interface ChartElement extends ContentElementBase {
  type: 'chart';
  /** Type of chart to render */
  chartType: 'bar' | 'line' | 'pie' | 'donut';
  /** Chart title */
  title?: string;
  /** Fields to include in the chart */
  fields: string[];
  /** Optional label field for categories */
  labelField?: string;
  /** Optional custom colors for chart elements */
  colors?: string[];
  /** Height of the chart in pixels */
  height?: number;
  /** Width of the chart (or 'auto' for responsive) */
  width?: number | 'auto';
  /** Optional chart-specific configuration */
  options?: Record<string, any>;
}

/**
 * Configuration for rendering a simple attribute table
 */
export interface TableElement extends ContentElementBase {
  type: 'table';
  /** Table title */
  title?: string;
  /** Fields to include in the table */
  fields: Array<{
    name: string;
    label?: string;
    format?: LayerFieldFormat;
  }>;
}

/**
 * Configuration for rendering text content
 */
export interface TextElement extends ContentElementBase {
  type: 'text';
  /** Text content, can include arcade expressions in {} */
  text: string;
  /** Optional formatting */
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: 'small' | 'medium' | 'large';
  };
}

/**
 * Union type for all popup content elements
 */
export type ContentElement =
  | FieldsElement
  | ArcadeElement
  | ChartElement
  | TableElement
  | TextElement;

/**
 * Field info structure based on ArcGIS FieldInfo
 */
export interface FieldInfo {
  fieldName: string;
  label?: string;
  visible?: boolean;
  format?: {
    places?: number;
    digitSeparator?: boolean;
    dateFormat?: 'short-date' | 'long-date' | 'short-date-time';
    prefix?: string;
    suffix?: string;
  };
}

/**
 * Main popup configuration interface for ArcGIS popups
 */
export interface PopupConfiguration {
  /** Arcade expression string to generate the popup title */
  titleExpression: string;
  /** Optional CSS classes to apply to the popup container */
  className?: string;
  /** Array of content elements to display in the popup */
  content: ContentElement[];
  /** Optional actions to display in the popup */
  actions?: any[];
}

/**
 * Helper function to create a default popup config
 */
export function createDefaultPopupConfig(): PopupConfiguration {
  return {
    titleExpression: "IIf(HasKey($feature, 'NAME'), $feature.NAME, \"Feature \" + $feature.OBJECTID)",
    content: [
      {
        type: 'fields',
        fieldInfos: [],
        displayType: 'list'
      }
    ]
  };
} 