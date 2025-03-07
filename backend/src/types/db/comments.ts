// types/db/comments.ts

import { Comment, Reply } from '../index.js';

// Comment-related database extensions
export interface ICommentExtensions {
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