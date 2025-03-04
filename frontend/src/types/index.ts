// Path: types\index.ts
export interface Position {
  lng: number;
  lat: number;
}

export interface User {
  id: string;
  name: string;
  position: Position;
}

export interface Users {
  [userId: string]: User;
}

export interface Map {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface MapFormData {
  name: string;
  description: string;
}

export interface Comment {
  id: number;
  map_id: number;
  user_id: string;
  user_name: string;
  content: string;
  lng: number;
  lat: number;
  created_at: string;
  updated_at: string;
  replies: Reply[];
}

export interface Reply {
  id: number;
  comment_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CommentFormData {
  content: string;
}

export interface ReplyFormData {
  content: string;
}