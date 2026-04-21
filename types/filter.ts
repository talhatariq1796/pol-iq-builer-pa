export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'between'
  | 'in'
  | 'notIn';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | (string | number)[];
}

export interface FilterPreset {
  name: string;
  conditions: FilterCondition[];
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  conditions: FilterCondition[];
  groups?: FilterGroup[];
} 