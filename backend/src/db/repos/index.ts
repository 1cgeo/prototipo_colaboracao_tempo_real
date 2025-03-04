// Path: db\repos\index.ts
import { IDatabase } from 'pg-promise';
import { MapsRepository } from './maps.repo.js';
import { CommentsRepository } from './comments.repo.js';
import { RepliesRepository } from './replies.repo.js';

// This function initializes all repositories and attaches them to the database object
export function initRepositories(db: IDatabase<any>): void {
  // Create repository instances
  const mapsRepo = new MapsRepository(db);
  const commentsRepo = new CommentsRepository(db);
  const repliesRepo = new RepliesRepository(db);
  
  // Extend db object with repository methods directly
  Object.assign(db, {
    // Maps methods
    getMaps: () => mapsRepo.getMaps(),
    getMap: (id: number) => mapsRepo.getMap(id),
    createMap: (name: string, description: string | null) => mapsRepo.createMap(name, description),
    updateMap: (id: number, name: string, description: string | null) => mapsRepo.updateMap(id, name, description),
    deleteMap: (id: number) => mapsRepo.deleteMap(id),
    
    // Comments methods
    getMapComments: (mapId: number) => commentsRepo.getMapComments(mapId),
    getCommentReplies: (commentId: number) => commentsRepo.getCommentReplies(commentId),
    createComment: (data: any) => commentsRepo.createComment(data),
    getComment: (id: number) => commentsRepo.getComment(id),
    updateComment: (id: number, content: string) => commentsRepo.updateComment(id, content),
    updateCommentPosition: (id: number, lng: number, lat: number) => 
      commentsRepo.updateCommentPosition(id, lng, lat),
    deleteComment: (id: number) => commentsRepo.deleteComment(id),
    
    // Replies methods
    createReply: (data: any) => repliesRepo.createReply(data),
    getReply: (id: number) => repliesRepo.getReply(id),
    updateReply: (id: number, content: string) => repliesRepo.updateReply(id, content),
    deleteReply: (id: number) => repliesRepo.deleteReply(id),
    getCommentMapId: (commentId: number) => repliesRepo.getCommentMapId(commentId),
  });
}