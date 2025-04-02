// Path: types\db\features.ts

import { Feature } from '../feature.types.js';
import { FeatureHistory } from '../history.types.js';

// Feature-related database extensions
export interface IFeatureExtensions {
  // Feature methods
  getMapFeatures(mapId: number): Promise<Feature[]>;
  getMapFeaturesByType(mapId: number, featureType: string): Promise<Feature[]>;
  getFeature(id: string): Promise<Feature | null>;
  getFeatureByClientId(clientId: string, mapId: number): Promise<Feature | null>;
  createFeature(data: {
    map_id: number;
    feature_type: string;
    geometry: any;
    properties: Record<string, any>;
    user_id: string;
    user_name: string;
    client_id?: string;
    offline_created?: boolean;
  }): Promise<Feature>;
  updateFeature(
    id: string, 
    data: {
      geometry?: any;
      properties?: Record<string, any>;
      version: number;
    }, 
    userId: string,
    userName: string
  ): Promise<{ success: boolean; feature?: Feature; currentVersion?: number }>;
  deleteFeature(id: string): Promise<boolean>;
  bulkDeleteFeatures(ids: string[]): Promise<number>;
  getFeaturesInBounds(
    mapId: number,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Promise<Feature[]>;
  
  // New sync methods
  getUpdatedFeatures(
    mapId: number,
    since: number,
    page?: number,
    limit?: number
  ): Promise<Feature[]>;
  
  getFeaturesInViewportSince(
    mapId: number,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    since: number,
    page?: number,
    limit?: number
  ): Promise<Feature[]>;
  
  getUpdatedFeaturesCount(
    mapId: number,
    since: number
  ): Promise<number>;
  
  isFeatureDeleted(featureId: string): Promise<boolean>;
  
  // Feature history methods
  recordFeatureCreation(
    feature: Feature, 
    userId: string, 
    userName: string, 
    clientOperationId?: string
  ): Promise<FeatureHistory>;
  
  recordFeatureUpdate(
    previousState: Feature, 
    newState: Feature, 
    userId: string,
    userName: string,
    clientOperationId?: string
  ): Promise<FeatureHistory>;
  
  recordFeatureDeletion(
    feature: Feature, 
    userId: string, 
    userName: string,
    clientOperationId?: string
  ): Promise<FeatureHistory>;
  
  getFeatureHistory(featureId: string): Promise<FeatureHistory[]>;
  getMapHistory(mapId: number, limit?: number): Promise<FeatureHistory[]>;
  getMapHistorySince(
    mapId: number, 
    since: number,
    page?: number,
    limit?: number
  ): Promise<FeatureHistory[]>;
  
  getDeletedFeaturesSince(
    mapId: number, 
    since: number
  ): Promise<string[]>;
  
  getOperationByClientId(clientOperationId: string): Promise<FeatureHistory | null>;
}