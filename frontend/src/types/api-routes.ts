import { MapBounds } from './index';

export const API_ROUTES = {
  // Room Management
  listRooms: '/api/maps',
  createRoom: '/api/maps',
  getRoom: (uuid: string) => `/api/maps/${uuid}`,
  updateRoom: (uuid: string) => `/api/maps/${uuid}`,
  deleteRoom: (uuid: string) => `/api/maps/${uuid}`,

  // Comments and Replies
  listComments: (roomId: string, bounds?: MapBounds) => {
    const url = `/api/maps/${roomId}/comments`;
    if (bounds) {
      return `${url}?bounds=${encodeURIComponent(JSON.stringify(bounds))}`;
    }
    return url;
  },
  createComment: (roomId: string) => `/api/maps/${roomId}/comments`,
  updateComment: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}`,
  deleteComment: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}`,
  createReply: (roomId: string, commentId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies`,
  updateReply: (roomId: string, commentId: string, replyId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies/${replyId}`,
  deleteReply: (roomId: string, commentId: string, replyId: string) => 
    `/api/maps/${roomId}/comments/${commentId}/replies/${replyId}`,

  // Activity Logs
  getActivityLog: (roomId: string) => `/api/maps/${roomId}/activity`,
  getUserActivity: (roomId: string, userId: string) => 
    `/api/maps/${roomId}/activity/${userId}`,
};