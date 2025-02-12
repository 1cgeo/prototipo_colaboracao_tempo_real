import { v4 as uuidv4 } from 'uuid';
import { UserInfo, AuthenticationSuccess, mapAuthSuccessToUserInfo } from '../types/auth';

const USER_INFO_KEY = 'userInfo';

// Get or create persistent userId only (displayName comes from server)
export const getUserId = (): string => {
  const stored = localStorage.getItem(USER_INFO_KEY);
  if (stored) {
    const userInfo = JSON.parse(stored);
    return userInfo.userId;
  }

  const newUserId = uuidv4();
  // We store only the userId since displayName will come from server
  localStorage.setItem(USER_INFO_KEY, JSON.stringify({ userId: newUserId }));
  return newUserId;
};

// Handle successful authentication response from server
export const handleAuthSuccess = (authData: AuthenticationSuccess): UserInfo => {
  const userInfo = mapAuthSuccessToUserInfo(authData);
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  return userInfo;
};