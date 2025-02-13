import { v4 as uuidv4 } from 'uuid';
import { UserInfo as ApiUserInfo } from '../types';
import { UserInfo, mapAuthSuccessToUserInfo } from '../types/auth';

const USER_INFO_KEY = 'userInfo';

// Get or create persistent userId only (displayName comes from server)
export const getUserId = (): string => {
  const stored = localStorage.getItem(USER_INFO_KEY);
  if (stored) {
    const userInfo = JSON.parse(stored) as UserInfo;
    return userInfo.userId;
  }

  const newUserId = uuidv4();
  // We store only the userId since displayName will come from server
  localStorage.setItem(USER_INFO_KEY, JSON.stringify({ userId: newUserId }));
  return newUserId;
};

// Store user info in local storage
export const storeUserInfo = (apiInfo: ApiUserInfo): void => {
  const userInfo = mapAuthSuccessToUserInfo(apiInfo);
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
};