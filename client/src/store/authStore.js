import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Global Authentication Store (Zustand)
// Manages User Session, JWT, and 2FA Challenge States globally.
// Uses persist middleware to survive page refreshes (localStorage).
// ============================================================================
export const useAuthStore = create(
  persist(
    (set) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      
      // 2FA Challenge State (Temporary state during login phase)
      is2FAPending: false,
      pendingToken: null,

      // Actions
      login: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true, 
        is2FAPending: false, 
        pendingToken: null 
      }),

      setPending2FA: (pendingToken) => set({ 
        is2FAPending: true, 
        pendingToken 
      }),

      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false, 
        is2FAPending: false, 
        pendingToken: null 
      }),
      
      updateUser: (updatedUser) => set((state) => ({
        user: { ...state.user, ...updatedUser }
      })),
    }),
    {
      name: 'auth-storage', // Key used in localStorage
      // We only persist essential auth data, not temporary 2FA challenge tokens if possible, 
      // but keeping it simple for the MVP
    }
  )
);
