// Path: api\comments.ts
import { Comment, CommentFormData, Reply, ReplyFormData } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

export const fetchMapComments = async (mapId: number): Promise<Comment[]> => {
  const response = await fetch(`${API_URL}/maps/${mapId}/comments`);
  if (!response.ok) throw new Error('Failed to fetch comments');
  return response.json();
};

export const createComment = async (
  mapId: number, 
  userId: string, 
  userName: string, 
  position: { lng: number, lat: number },
  data: CommentFormData
): Promise<Comment> => {
  const response = await fetch(`${API_URL}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      map_id: mapId,
      user_id: userId,
      user_name: userName,
      content: data.content,
      lng: position.lng,
      lat: position.lat
    })
  });
  
  if (!response.ok) throw new Error('Failed to create comment');
  return response.json();
};

export const updateComment = async (
  commentId: number, 
  userId: string, 
  data: CommentFormData
): Promise<Comment> => {
  const response = await fetch(`${API_URL}/comments/${commentId}?userId=${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: data.content
    })
  });
  
  if (!response.ok) throw new Error('Failed to update comment');
  return response.json();
};

export const updateCommentPosition = async (
  commentId: number, 
  userId: string, 
  position: { lng: number, lat: number }
): Promise<Comment> => {
  const response = await fetch(`${API_URL}/comments/${commentId}/position?userId=${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lng: position.lng,
      lat: position.lat
    })
  });
  
  if (!response.ok) throw new Error('Failed to update comment position');
  return response.json();
};

export const deleteComment = async (
  commentId: number, 
  userId: string
): Promise<void> => {
  const response = await fetch(`${API_URL}/comments/${commentId}?userId=${userId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) throw new Error('Failed to delete comment');
};

export const createReply = async (
  commentId: number, 
  userId: string, 
  userName: string, 
  data: ReplyFormData
): Promise<Reply> => {
  const response = await fetch(`${API_URL}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      comment_id: commentId,
      user_id: userId,
      user_name: userName,
      content: data.content
    })
  });
  
  if (!response.ok) throw new Error('Failed to create reply');
  return response.json();
};

export const updateReply = async (
  replyId: number, 
  userId: string, 
  data: ReplyFormData
): Promise<Reply> => {
  const response = await fetch(`${API_URL}/replies/${replyId}?userId=${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: data.content
    })
  });
  
  if (!response.ok) throw new Error('Failed to update reply');
  return response.json();
};

export const deleteReply = async (
  replyId: number, 
  userId: string
): Promise<void> => {
  const response = await fetch(`${API_URL}/replies/${replyId}?userId=${userId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) throw new Error('Failed to delete reply');
};