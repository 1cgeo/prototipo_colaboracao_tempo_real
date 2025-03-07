// Path: types\index.ts

/**
 * Map definition
 */
export interface Map {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
}

/**
 * Position coordinates
 */
export interface Position {
  lng: number;
  lat: number;
}

/**
 * Comment definition
 */
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

/**
 * Reply definition
 */
export interface Reply {
  id: number;
  comment_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Data for creating a comment
 */
export interface CommentCreateData {
  map_id: number;
  user_id: string;
  user_name: string;
  content: string;
  lng: number;
  lat: number;
}

/**
 * Data for updating a comment
 */
export interface CommentUpdateData {
  content: string;
}

/**
 * Data for updating a comment position
 */
export interface CommentPositionUpdateData {
  lng: number;
  lat: number;
}

/**
 * Data for creating a reply
 */
export interface ReplyCreateData {
  comment_id: number;
  user_id: string;
  user_name: string;
  content: string;
}

/**
 * Data for updating a reply
 */
export interface ReplyUpdateData {
  content: string;
}