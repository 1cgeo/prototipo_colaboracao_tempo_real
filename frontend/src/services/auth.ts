import { v4 as uuidv4 } from 'uuid';

const USER_INFO_KEY = 'userInfo';

export interface UserInfo {
  userId: string;
  displayName: string;
}

// Type guard function to validate UserInfo structure
const isValidUserInfo = (value: unknown): value is UserInfo => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.displayName === 'string' &&
    candidate.userId.length > 0 &&
    candidate.displayName.length > 0
  );
};

// Get or create persistent user info with validation
export const getUserInfo = (): UserInfo => {
  try {
    const stored = localStorage.getItem(USER_INFO_KEY);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      
      if (!isValidUserInfo(parsed)) {
        throw new Error('Invalid stored user info');
      }
      
      return parsed;
    }

    const userId = uuidv4();
    const displayName = `User-${userId.slice(0, 6)}`;
    const userInfo: UserInfo = { userId, displayName };
    
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
    return userInfo;
  } catch {
    // Clean up potentially corrupted data
    localStorage.removeItem(USER_INFO_KEY);
    
    // Create new user info as fallback
    const userId = uuidv4();
    const displayName = `User-${userId.slice(0, 6)}`;
    const userInfo: UserInfo = { userId, displayName };
    
    try {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      return userInfo;
    } catch {
      throw new Error('Failed to initialize user information');
    }
  }
};

// Store user info after server update with validation
export const storeUserInfo = (apiInfo: { user_id: string; display_name: string }) => {
  if (!apiInfo.user_id || !apiInfo.display_name) {
    throw new Error('Invalid user info received from API');
  }

  const userInfo: UserInfo = {
    userId: apiInfo.user_id,
    displayName: apiInfo.display_name
  };

  try {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  } catch {
    throw new Error('Failed to store user information');
  }
};