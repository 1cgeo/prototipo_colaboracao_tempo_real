// Path: types\index.ts
export interface Map {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
}

export interface Position {
  lng: number;
  lat: number;
}

export interface User {
  id: string;
  name: string;
  position: Position;
}

export interface Rooms {
  [roomId: string]: {
    [userId: string]: User;
  };
}

export interface Comment {
  id: number;
  map_id: number;
  user_id: string;
  user_name: string;
  content: string;
  lng: number;
  lat: number;
  created_at: Date;
  updated_at: Date;
  replies?: Reply[];
}

export interface Reply {
  id: number;
  comment_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface CommentCreateData {
  map_id: number;
  user_id: string;
  user_name: string;
  content: string;
  lng: number;
  lat: number;
}

export interface CommentUpdateData {
  content: string;
}

export interface CommentPositionUpdateData {
  lng: number;
  lat: number;
}

export interface ReplyCreateData {
  comment_id: number;
  user_id: string;
  user_name: string;
  content: string;
}

export interface ReplyUpdateData {
  content: string;
}
