// Path: store\useCommentStore.ts
import { create } from 'zustand';
import { Comment, Reply } from '../types';

interface CommentState {
  comments: Comment[];
  selectedComment: Comment | null;
  isAddingComment: boolean;
  isDraggingComment: boolean | number; // false or comment id
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  updateComment: (comment: Comment) => void;
  moveComment: (comment: Comment) => void;
  deleteComment: (commentId: number) => void;
  addReply: (reply: Reply, commentId: number) => void;
  updateReply: (reply: Reply, commentId: number) => void;
  deleteReply: (replyId: number, commentId: number) => void;
  selectComment: (comment: Comment | null) => void;
  setIsAddingComment: (isAdding: boolean) => void;
  setIsDraggingComment: (isDragging: boolean | number) => void;
}

// Helper to ensure no duplicate comments and validate comment data
const ensureUniqueComments = (comments: Comment[]): Comment[] => {
  const uniqueMap = new Map<number, Comment>();
  
  comments.forEach(comment => {
    // Validate comment has required fields
    if (comment && comment.id && typeof comment.lng === 'number' && typeof comment.lat === 'number') {
      // Ensure replies exists (even if empty array)
      const validComment = {
        ...comment,
        replies: Array.isArray(comment.replies) ? comment.replies : []
      };
      
      uniqueMap.set(comment.id, validComment);
    } else {
      console.warn("Invalid comment data:", comment);
    }
  });
  
  return Array.from(uniqueMap.values());
};

export const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  selectedComment: null,
  isAddingComment: false,
  isDraggingComment: false,

  setComments: (comments) => {
    console.log("Setting comments in store:", comments.length);
    set({ 
      comments: ensureUniqueComments(comments) 
    });
  },
  
  addComment: (comment) => set((state) => {
    // Skip invalid comments
    if (!comment || !comment.id || typeof comment.lng !== 'number' || typeof comment.lat !== 'number') {
      console.warn("Invalid comment in addComment:", comment);
      return state;
    }
    
    // Check if comment already exists
    const commentExists = state.comments.some(c => c.id === comment.id);
    if (commentExists) {
      // Update existing comment instead of adding new one
      return {
        comments: state.comments.map(c => c.id === comment.id ? {
          ...comment,
          replies: Array.isArray(comment.replies) ? comment.replies : []
        } : c)
      };
    }
    
    // Add new comment
    return {
      comments: ensureUniqueComments([{
        ...comment,
        replies: Array.isArray(comment.replies) ? comment.replies : []
      }, ...state.comments])
    };
  }),
  
  updateComment: (updatedComment) => set((state) => {
    // Skip invalid comments
    if (!updatedComment || !updatedComment.id) {
      console.warn("Invalid comment in updateComment:", updatedComment);
      return state;
    }
    
    return {
      comments: ensureUniqueComments(
        state.comments.map(comment => 
          comment.id === updatedComment.id ? {
            ...updatedComment,
            replies: Array.isArray(updatedComment.replies) ? updatedComment.replies : comment.replies
          } : comment
        )
      ),
      selectedComment: state.selectedComment?.id === updatedComment.id ? 
        { 
          ...updatedComment, 
          replies: Array.isArray(updatedComment.replies) ? 
            updatedComment.replies : state.selectedComment.replies 
        } : state.selectedComment
    };
  }),
  
  moveComment: (movedComment) => set((state) => {
    // Skip invalid comments
    if (!movedComment || !movedComment.id || typeof movedComment.lng !== 'number' || typeof movedComment.lat !== 'number') {
      console.warn("Invalid comment in moveComment:", movedComment);
      return state;
    }
    
    return {
      comments: ensureUniqueComments(
        state.comments.map(comment => 
          comment.id === movedComment.id ? {
            ...comment,
            lng: movedComment.lng,
            lat: movedComment.lat
          } : comment
        )
      ),
      selectedComment: state.selectedComment?.id === movedComment.id ? 
        { ...state.selectedComment, lng: movedComment.lng, lat: movedComment.lat } : 
        state.selectedComment
    };
  }),
  
  deleteComment: (commentId) => set((state) => ({
    comments: state.comments.filter(comment => comment.id !== commentId),
    selectedComment: state.selectedComment?.id === commentId ? null : state.selectedComment
  })),
  
  addReply: (reply, commentId) => set((state) => {
    if (!reply || !reply.id || !commentId) {
      console.warn("Invalid reply in addReply:", reply, commentId);
      return state;
    }
    
    return {
      comments: state.comments.map(comment => {
        if (comment.id === commentId) {
          // Check for duplicate replies
          const replyExists = comment.replies.some(r => r.id === reply.id);
          if (replyExists) {
            return {
              ...comment,
              replies: comment.replies.map(r => r.id === reply.id ? reply : r)
            };
          }
          return {
            ...comment,
            replies: [...comment.replies, reply]
          };
        }
        return comment;
      }),
      selectedComment: state.selectedComment?.id === commentId ? {
        ...state.selectedComment,
        replies: state.selectedComment.replies.some(r => r.id === reply.id) 
          ? state.selectedComment.replies.map(r => r.id === reply.id ? reply : r)
          : [...state.selectedComment.replies, reply]
      } : state.selectedComment
    };
  }),
  
  updateReply: (updatedReply, commentId) => set((state) => ({
    comments: state.comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: comment.replies.map(reply => 
            reply.id === updatedReply.id ? updatedReply : reply
          )
        };
      }
      return comment;
    }),
    selectedComment: state.selectedComment?.id === commentId ? {
      ...state.selectedComment,
      replies: state.selectedComment.replies.map(reply => 
        reply.id === updatedReply.id ? updatedReply : reply
      )
    } : state.selectedComment
  })),
  
  deleteReply: (replyId, commentId) => set((state) => ({
    comments: state.comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: comment.replies.filter(reply => reply.id !== replyId)
        };
      }
      return comment;
    }),
    selectedComment: state.selectedComment?.id === commentId ? {
      ...state.selectedComment,
      replies: state.selectedComment.replies.filter(reply => reply.id !== replyId)
    } : state.selectedComment
  })),
  
  selectComment: (comment) => set({ selectedComment: comment }),
  
  setIsAddingComment: (isAdding) => set({ isAddingComment: isAdding }),
  
  setIsDraggingComment: (isDragging) => set({ isDraggingComment: isDragging })
}));