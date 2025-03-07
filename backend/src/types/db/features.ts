// Path: types\db\features.ts

import { Feature } from '../feature.types.js';
import { FeatureHistory } from '../history.types.js';

// Feature-related database extensions
export interface IFeatureExtensions {
  // Feature methods
  getMapFeatures(mapId: number): Promise<Feature[]>;
  getMapFeaturesByType(mapId: number, featureType: string): Promise<Feature[]>;
  getFeature(id: number): Promise<Feature | null>;
  createFeature(data: {
    map_id: number;
    feature_type: string;
    geometry: any;
    properties: Record<string, any>;
    user_id: string;
    user_name: string;
  }): Promise<Feature>;
  updateFeature(
    id: number, 
    data: {
      geometry?: any;
      properties?: Record<string, any>;
      version: number;
    }, 
    userId: string,
    userName: string
  ): Promise<{ success: boolean; feature?: Feature; currentVersion?: number }>;
  deleteFeature(id: number): Promise<boolean>;
  bulkDeleteFeatures(ids: number[]): Promise<number>;
  getFeaturesInBounds(
    mapId: number,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Promise<Feature[]>;
  
  // Feature history methods
  recordFeatureCreation(feature: Feature, userId: string, userName: string): Promise<FeatureHistory>;
  recordFeatureUpdate(
    previousState: Feature, 
    newState: Feature, 
    userId: string,
    userName: string
  ): Promise<FeatureHistory>;
  recordFeatureDeletion(feature: Feature, userId: string, userName: string): Promise<FeatureHistory>;
  getFeatureHistory(featureId: number): Promise<FeatureHistory[]>;
  getMapHistory(mapId: number, limit?: number): Promise<FeatureHistory[]>;
}