export interface AuthConfig {
  user_id: string;
  display_name: string;
}

export interface UserInfo {
  userId: string;
  displayName: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthErrorDetails {
  current_version?: number;
  provided_version?: number;
  server_data?: unknown;
  field?: string;
  value?: unknown;
  constraint?: string;
}

export interface AuthenticationError {
  code: string;
  message: string;
  details?: AuthErrorDetails;
}