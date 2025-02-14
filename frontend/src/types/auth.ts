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

// Detalhes específicos de erro baseados na documentação
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

// Mapping function to convert from backend to frontend format
export const mapAuthSuccessToUserInfo = (apiInfo: UserInfo): UserInfo => ({
  userId: apiInfo.userId,
  displayName: apiInfo.displayName
});