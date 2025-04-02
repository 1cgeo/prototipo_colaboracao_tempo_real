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
 * Comment definition
 */
export interface Comment {
  id: string; // UUID
  map_id: number;
  user_id: string;
  user_name: string;
  content: string;
  lng: number;
  lat: number;
  created_at: Date;
  updated_at: Date;
  client_id?: string;
  offline_created?: boolean;
  replies?: Reply[];
}

/**
 * Reply definition
 */
export interface Reply {
  id: string; // UUID
  comment_id: string; // UUID
  user_id: string;
  user_name: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  client_id?: string;
  offline_created?: boolean;
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
  client_id?: string;
  offline_created?: boolean;
}

/**
 * Data for creating a reply
 */
export interface ReplyCreateData {
  comment_id: string; // UUID
  user_id: string;
  user_name: string;
  content: string;
  client_id?: string;
  offline_created?: boolean;
}