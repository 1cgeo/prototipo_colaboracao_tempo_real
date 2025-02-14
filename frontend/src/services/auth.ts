import { v4 as uuidv4 } from 'uuid';

const USER_INFO_KEY = 'userInfo';

export interface UserInfo {
  userId: string;
  displayName: string;
}

// Validate user info structure
const isValidUserInfo = (info: any): info is UserInfo => {
  return (
    typeof info === 'object' &&
    info !== null &&
    typeof info.userId === 'string' &&
    typeof info.displayName === 'string' &&
    info.userId.length > 0 &&
    info.displayName.length > 0
  );
};

// Get or create persistent user info with validation
export const getUserInfo = (): UserInfo => {
  console.log('[Auth] Getting user info from localStorage');
  
  try {
    const stored = localStorage.getItem(USER_INFO_KEY);
    
    if (stored) {
      console.log('[Auth] Found stored user info');
      const parsed = JSON.parse(stored);
      
      if (!isValidUserInfo(parsed)) {
        console.warn('[Auth] Stored user info is invalid, creating new');
        throw new Error('Invalid stored user info');
      }
      
      console.log('[Auth] Returning valid stored user info:', parsed);
      return parsed;
    }

    console.log('[Auth] No stored user info found, creating new');
    const userId = uuidv4();
    const displayName = `User-${userId.slice(0, 6)}`;
    const userInfo: UserInfo = { userId, displayName };
    
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
    console.log('[Auth] Created and stored new user info:', userInfo);
    
    return userInfo;
  } catch (error) {
    console.error('[Auth] Error in getUserInfo:', error);
    
    // Clean up potentially corrupted data
    localStorage.removeItem(USER_INFO_KEY);
    
    // Create new user info as fallback
    const userId = uuidv4();
    const displayName = `User-${userId.slice(0, 6)}`;
    const userInfo: UserInfo = { userId, displayName };
    
    try {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      console.log('[Auth] Created fallback user info:', userInfo);
      return userInfo;
    } catch (storageError) {
      console.error('[Auth] Failed to store fallback user info:', storageError);
      throw new Error('Failed to initialize user information');
    }
  }
};

// Store user info after server update with validation
export const storeUserInfo = (apiInfo: { user_id: string; display_name: string }) => {
  console.log('[Auth] Storing user info from API:', apiInfo);
  
  if (!apiInfo.user_id || !apiInfo.display_name) {
    console.error('[Auth] Invalid API user info:', apiInfo);
    throw new Error('Invalid user info received from API');
  }

  const userInfo: UserInfo = {
    userId: apiInfo.user_id,
    displayName: apiInfo.display_name
  };

  try {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
    console.log('[Auth] Successfully stored user info');
  } catch (error) {
    console.error('[Auth] Failed to store user info:', error);
    throw new Error('Failed to store user information');
  }
};