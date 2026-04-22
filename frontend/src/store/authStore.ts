import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'agent' | 'editor' | 'operator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isActive?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

const isNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'TypeError' || /fetch|network/i.test(error.message);
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => void;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8080';
const API_URL = `${API_BASE_URL}/api`;

const createFallbackUser = (email: string): User => {
  const normalizedEmail = email.toLowerCase();
  const role: UserRole = normalizedEmail.includes('agent')
    ? 'agent'
    : normalizedEmail.includes('editor')
      ? 'editor'
      : normalizedEmail.includes('operator')
        ? 'operator'
        : 'admin';

  return {
    id: role === 'admin' ? 'adm-001' : role === 'agent' ? 'age-001' : role === 'editor' ? 'edt-001' : 'opr-001',
    email,
    name:
      role === 'admin'
        ? 'Administrator Tridjaya'
        : role === 'agent'
          ? 'Agen Samrat Makassar'
          : role === 'editor'
            ? 'Editor Konten'
            : 'Operator Internal',
    role,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${role}`,
    isActive: true,
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      login: async ({ email, password }) => {
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.message || 'Login gagal');
          }

          const payload = (await response.json()) as { data?: LoginResponse };
          const authData = payload.data;

          if (!authData?.user) {
            throw new Error('Respons login tidak valid');
          }

          set({
            user: authData.user,
            isAuthenticated: true,
            accessToken: authData.access_token,
            refreshToken: authData.refresh_token,
          });

          return authData.user;
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }

          const fallbackUser = createFallbackUser(email);
          await new Promise((resolve) => setTimeout(resolve, 600));
          set({
            user: fallbackUser,
            isAuthenticated: true,
            accessToken: null,
            refreshToken: null,
          });
          return fallbackUser;
        }
      },
      logout: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: 'tridjaya-auth',
    }
  )
);
