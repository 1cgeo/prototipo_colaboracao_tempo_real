import { API_ROUTES } from '../../types';
import { 
  Comment, 
  CommentCreateInput, 
  CommentUpdateInput,
  Reply, 
  ReplyCreateInput, 
  ReplyUpdateInput,
  MapBounds,
} from '../../types';

// Generic response handler
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }
  return data.data;
}

// Comments API
export const commentApi = {
  list: async (roomId: string, bounds?: MapBounds): Promise<Comment[]> => {
    const response = await fetch(API_ROUTES.listComments(roomId, bounds));
    return handleResponse<Comment[]>(response);
  },

  create: async (roomId: string, input: CommentCreateInput): Promise<Comment> => {
    const response = await fetch(API_ROUTES.createComment(roomId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  update: async (roomId: string, commentId: string, input: CommentUpdateInput): Promise<Comment> => {
    const response = await fetch(API_ROUTES.updateComment(roomId, commentId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Comment>(response);
  },

  delete: async (roomId: string, commentId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteComment(roomId, commentId), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Replies API
export const replyApi = {
  create: async (roomId: string, commentId: string, input: ReplyCreateInput): Promise<Reply> => {
    const response = await fetch(API_ROUTES.createReply(roomId, commentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Reply>(response);
  },

  update: async (
    roomId: string, 
    commentId: string, 
    replyId: string, 
    input: ReplyUpdateInput
  ): Promise<Reply> => {
    const response = await fetch(API_ROUTES.updateReply(roomId, commentId, replyId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<Reply>(response);
  },

  delete: async (roomId: string, commentId: string, replyId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.deleteReply(roomId, commentId, replyId), {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};