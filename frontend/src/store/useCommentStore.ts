// src/store/useCommentStore.ts
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

export const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  selectedComment: null,
  isAddingComment: false,
  isDraggingComment: false,

  setComments: (comments) => set({ comments }),
  
  addComment: (comment) => set((state) => ({
    comments: [comment, ...state.comments]
  })),
  
  updateComment: (updatedComment) => set((state) => ({
    comments: state.comments.map(comment => 
      comment.id === updatedComment.id ? updatedComment : comment
    ),
    selectedComment: state.selectedComment?.id === updatedComment.id ? 
      updatedComment : state.selectedComment
  })),
  
  moveComment: (movedComment) => set((state) => ({
    comments: state.comments.map(comment => 
      comment.id === movedComment.id ? movedComment : comment
    ),
    selectedComment: state.selectedComment?.id === movedComment.id ? 
      movedComment : state.selectedComment
  })),
  
  deleteComment: (commentId) => set((state) => ({
    comments: state.comments.filter(comment => comment.id !== commentId),
    selectedComment: state.selectedComment?.id === commentId ? null : state.selectedComment
  })),
  
  addReply: (reply, commentId) => set((state) => ({
    comments: state.comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [...comment.replies, reply]
        };
      }
      return comment;
    }),
    selectedComment: state.selectedComment?.id === commentId ? {
      ...state.selectedComment,
      replies: [...state.selectedComment.replies, reply]
    } : state.selectedComment
  })),
  
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