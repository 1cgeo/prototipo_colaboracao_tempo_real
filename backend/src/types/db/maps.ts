// types/db/maps.ts

import { Map } from '../index.js';

// Map-related database extensions
export interface IMapExtensions {
  // Maps methods
  getMaps(): Promise<Map[]>;
  getMap(id: number): Promise<Map | null>;
  createMap(name: string, description: string | null): Promise<Map>;
  updateMap(
    id: number,
    name: string,
    description: string | null,
  ): Promise<Map | null>;
  deleteMap(id: number): Promise<boolean>;
}