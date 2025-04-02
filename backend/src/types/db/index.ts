// Path: types\db\index.ts

import { IDatabase } from 'pg-promise';
import { IMapExtensions } from './maps.js';
import { IFeatureExtensions } from './features.js';
import { ICommentExtensions } from './comments.js';

// Combine all extensions internally - IDB is the only exported type
interface IExtensions extends 
  IMapExtensions,
  IFeatureExtensions,
  ICommentExtensions
{}

// Export the combined types
export type IDB = IDatabase<IExtensions> & IExtensions;