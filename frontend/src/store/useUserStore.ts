// src/store/useUserStore.ts
import { create } from 'zustand';
import { User, Users } from '../types';

interface UserState {
  users: Users;
  currentUser: User | null;
  currentMap: number | null;
  setUsers: (users: User[]) => void;
  updateUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setCurrentMap: (mapId: number | null) => void;
  clearUsers: () => void;
  setCurrentUser: (user: User | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  users: {},
  currentUser: null,
  currentMap: null,
  setUsers: (users: User[]) => {
    const usersMap: Users = {};
    users.forEach(user => {
      usersMap[user.id] = user;
    });
    set({ users: usersMap });
  },
  updateUser: (user: User) => {
    set(state => ({
      users: {
        ...state.users,
        [user.id]: user
      }
    }));
  },
  removeUser: (userId: string) => {
    set(state => {
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
    set({ currentUser: user });
  }
}));