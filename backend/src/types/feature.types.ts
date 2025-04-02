// Path: types\feature.types.ts

// Common type for all feature types - only export Feature and the DTOs as they're the ones used externally
// Internal types are kept but not exported
type FeatureType = 'point' | 'line' | 'polygon' | 'text' | 'image';

// Base feature interface
interface BaseFeature {
  id: string; // UUID
  map_id: number;
  feature_type: FeatureType;
  geometry: any; // GeoJSON geometry
  properties: Record<string, any>;
  user_id: string;
  user_name: string;
  created_at: Date;
  updated_at: Date;
  version: number;
  client_id?: string;
  offline_created?: boolean;
}

// Point Feature
interface PointFeature extends BaseFeature {
  feature_type: 'point';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    color: string;
    size: number;
    opacity: number;
  };
}

// Line Feature
interface LineFeature extends BaseFeature {
  feature_type: 'line';
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>; // Array of [longitude, latitude]
  };
  properties: {
    color: string;
    size: number;
    opacity: number;
    showLength: boolean;
  };
}

// Polygon Feature
interface PolygonFeature extends BaseFeature {
  feature_type: 'polygon';
  geometry: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>; // Array of rings (array of [longitude, latitude])
  };
  properties: {
    fillColor: string;
    borderColor: string;
    borderSize: number;
    borderOpacity: number;
    fillOpacity: number;
    showArea: boolean;
  };
}

// Text Feature
interface TextFeature extends BaseFeature {
  feature_type: 'text';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    text: string;
    justification: string; // 'left', 'center', 'right'
    size: number;
    color: string;
    bufferColor: string;
    rotation: number; // in degrees
  };
}

// Image Feature
interface ImageFeature extends BaseFeature {
  feature_type: 'image';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] of the center
  };
  properties: {
    rotation: number; // in degrees
    size: number; // scale factor
    opacity: number; // 0.0-1.0
    imageType: string; // MIME type (e.g., 'image/png', 'image/jpeg')
  };
}

// Only export the union type and DTOs that are actually used externally
export type Feature = PointFeature | LineFeature | PolygonFeature | TextFeature | ImageFeature;

// DTOs for creating features
export interface CreateFeatureDTO {
  map_id: number;
  feature_type: FeatureType;
  geometry: any;
  properties: Record<string, any>;
  user_id: string;
  user_name: string;
  client_id?: string;
  offline_created?: boolean;
}

// DTO for updating features
export interface UpdateFeatureDTO {
  geometry?: any;
  properties?: Record<string, any>;
  version: number; // Required for conflict resolution
}