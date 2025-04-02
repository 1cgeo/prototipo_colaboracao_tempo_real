// Path: types\db\comments.ts

import { Comment, Reply } from '../index.js';

// Comment-related database extensions
export interface ICommentExtensions {
  // Comments methods
  getMapComments(mapId: number): Promise<Comment[]>;
  getCommentReplies(commentId: string): Promise<Reply[]>;
  getCommentByClientId(clientId: string, mapId: number): Promise<Comment | null>;
  createComment(data: {
    map_id: number;
    user_id: string;
    user_name: string;
    content: string;
    lng: number;
    lat: number;
    client_id?: string;
    offline_created?: boolean;
  }): Promise<Comment>;
  getComment(id: string): Promise<Comment | null>;
  updateComment(id: string, content: string): Promise<Comment | null>;
  updateCommentPosition(
    id: string,
    lng: number,
    lat: number,
  ): Promise<Comment | null>;
  deleteComment(id: string): Promise<boolean>;
  
  // New sync methods
  getUpdatedComments(
    mapId: number,
    since: number,
    page?: number,
    limit?: number
  ): Promise<Comment[]>;
  
  getUpdatedCommentsCount(
    mapId: number,
    since: number
  ): Promise<number>;
  
  // Replies methods
  createReply(data: {
    comment_id: string;
    user_id: string;
    user_name: string;
    content: string;
    client_id?: string;
    offline_created?: boolean;
  }): Promise<Reply>;
  getReply(id: string): Promise<Reply | null>;
  getReplyByClientId(clientId: string, commentId: string): Promise<Reply | null>;
  updateReply(id: string, content: string): Promise<Reply | null>;
  deleteReply(id: string): Promise<boolean>;
  getCommentMapId(commentId: string): Promise<number>;
}