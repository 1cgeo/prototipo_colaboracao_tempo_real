import { getSocket } from '../config/socket';
import { Point } from '../types';

export const wsEvents = {
  // Room events
  joinRoom: (roomId: string, userId: string, displayName: string) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('room:join', {
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      timestamp: Date.now()
    });
  },

  leaveRoom: (roomId: string, userId: string) => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.emit('room:leave', {
      room_id: roomId,
      user_id: userId,
      timestamp: Date.now()
    });
  },

  // Cursor events
  moveCursor: (roomId: string, userId: string, location: Point) => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.emit('cursor:move', {
      room_id: roomId,
      user_id: userId,
      location,
      timestamp: Date.now()
    });
  },

  // Comment events
  createComment: (roomId: string, userId: string, content: string, location: Point) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('comment:create', {
      room_id: roomId,
      user_id: userId,
      content,
      location,
      timestamp: Date.now()
    });
  },

  updateComment: (roomId: string, commentId: string, userId: string, content: string, version: number) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('comment:update', {
      room_id: roomId,
      comment_id: commentId,
      user_id: userId,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteComment: (roomId: string, commentId: string, userId: string, version: number) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('comment:delete', {
      room_id: roomId,
      comment_id: commentId,
      user_id: userId,
      version,
      timestamp: Date.now()
    });
  },

  // Reply events
  createReply: (roomId: string, commentId: string, userId: string, content: string) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('reply:create', {
      room_id: roomId,
      comment_id: commentId,
      user_id: userId,
      content,
      timestamp: Date.now()
    });
  },

  updateReply: (
    roomId: string,
    commentId: string,
    replyId: string,
    userId: string,
    content: string,
    version: number
  ) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('reply:update', {
      room_id: roomId,
      comment_id: commentId,
      reply_id: replyId,
      user_id: userId,
      content,
      version,
      timestamp: Date.now()
    });
  },

  deleteReply: (
    roomId: string,
    commentId: string,
    replyId: string,
    userId: string,
    version: number
  ) => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not initialized');
    
    socket.emit('reply:delete', {
      room_id: roomId,
      comment_id: commentId,
      reply_id: replyId,
      user_id: userId,
      version,
      timestamp: Date.now()
    });
  }
};