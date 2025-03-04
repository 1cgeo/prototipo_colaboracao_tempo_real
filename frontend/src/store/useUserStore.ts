// Path: store\useUserStore.ts
import { create } from 'zustand';
import { User, Users, Position } from '../types';

interface UserState {
  users: Users;
  currentUser: User | null;
  currentMap: number | null;
  disableCursorTracking: boolean;
  setUsers: (users: User[]) => void;
  updateUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setCurrentMap: (mapId: number | null) => void;
  clearUsers: () => void;
  setCurrentUser: (user: User | null) => void;
  toggleCursorTracking: (disabled: boolean) => void;
}

// Validate position to ensure it has lng and lat
const isValidPosition = (position: any): position is Position => {
  return position && 
    typeof position === 'object' &&
    'lng' in position && 
    'lat' in position &&
    typeof position.lng === 'number' &&
    typeof position.lat === 'number';
};

// Validate user data
const isValidUser = (user: any): user is User => {
  return user && 
    typeof user === 'object' &&
    'id' in user &&
    'name' in user;
};

// Default position for users without one
const DEFAULT_POSITION: Position = { lng: 0, lat: 0 };

export const useUserStore = create<UserState>((set) => ({
  users: {},
  currentUser: null,
  currentMap: null,
  disableCursorTracking: false,
  
  setUsers: (users: User[]) => {
    const usersMap: Users = {};
    users.forEach(user => {
      // Accept all users, but ensure they have valid position
      if (isValidUser(user)) {
        usersMap[user.id] = {
          ...user,
          position: isValidPosition(user.position) ? user.position : DEFAULT_POSITION
        };
      } else {
        console.warn("Invalid user data in setUsers:", user);
      }
    });
    set({ users: usersMap });
  },
  
  updateUser: (user: User) => {
    // Accept all users but ensure valid position
    if (!isValidUser(user)) {
      console.warn("Invalid user data in updateUser:", user);
      return;
    }
    
    set(state => {
      // If cursor tracking is disabled, still update the current user
      // but don't update other users' positions
      if (state.disableCursorTracking && 
          state.currentUser && 
          user.id !== state.currentUser.id) {
        return state;
      }
      
      // Ensure user has valid position
      const updatedUser = {
        ...user,
        position: isValidPosition(user.position) ? user.position : DEFAULT_POSITION
      };
      
      // Check if the user exists before updating
      if (!state.users[user.id] && user.id !== state.currentUser?.id) {
        console.log("Adding new user to state:", updatedUser);
      }
      
      return {
        users: {
          ...state.users,
          [user.id]: updatedUser
        }
      };
    });
  },
  
  removeUser: (userId: string) => {
    set(state => {
      if (!userId || !state.users[userId]) {
        return state; // No change if user doesn't exist
      }
      
      const newUsers = { ...state.users };
      delete newUsers[userId];
      return { users: newUsers };
    });
  },
  
  setCurrentMap: (mapId: number | null) => {
    set({ currentMap: mapId });
  },
  
  clearUsers: () => {
    set({ users: {} });
  },
  
  setCurrentUser: (user: User | null) => {
    if (user && !isValidUser(user)) {
      console.warn("Invalid user data in setCurrentUser, but proceeding with defaults:", user);
    }
    
    set(state => {
      // If we're setting the current user, also add them to the users map
      if (user) {
        const updatedUser = {
          ...user,
          // Ensure user has position, use DEFAULT if missing
          position: isValidPosition(user.position) ? user.position : DEFAULT_POSITION
        };
        
        return { 
          currentUser: updatedUser,
          users: {
            ...state.users,
            [user.id]: updatedUser
          }
        };
      }
      return { currentUser: null };
    });
  },
  
  toggleCursorTracking: (disabled: boolean) => {
    set({ disableCursorTracking: disabled });
  }
}));