import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'agent';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, role) => {
        // Mocking API delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        const mockUser: User = {
          id: role === 'admin' ? 'adm-001' : 'age-001',
          email,
          name: role === 'admin' ? 'Administrator Tridjaya' : 'Agen Samrat Makassar',
          role,
          avatar: role === 'admin' 
            ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin' 
            : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Agent',
        };

        set({ user: mockUser, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'tridjaya-auth',
    }
  )
);
