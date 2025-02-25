// src/types/db.ts
import { IDatabase } from 'pg-promise';
import { Map, Comment, Reply } from './index.js';

// Define a custom interface extending the pg-promise types
export interface IExtensions {
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

  // Comments methods
  getMapComments(mapId: number): Promise<Comment[]>;
  getCommentReplies(commentId: number): Promise<Reply[]>;
  createComment(data: {
    map_id: number;
    user_id: string;
    user_name: string;
    content: string;
    lng: number;
    lat: number;
  }): Promise<Comment>;
  getComment(id: number): Promise<Comment | null>;
  updateComment(id: number, content: string): Promise<Comment | null>;
  updateCommentPosition(
    id: number,
    lng: number,
    lat: number,
  ): Promise<Comment | null>;
  deleteComment(id: number): Promise<boolean>;

  // Replies methods
  createReply(data: {
    comment_id: number;
    user_id: string;
    user_name: string;
    content: string;
  }): Promise<Reply>;
  getReply(id: number): Promise<Reply | null>;
  updateReply(id: number, content: string): Promise<Reply | null>;
  deleteReply(id: number): Promise<boolean>;
  getCommentMapId(commentId: number): Promise<number>;
}

// Export the combined types
export type IDB = IDatabase<IExtensions> & IExtensions;
