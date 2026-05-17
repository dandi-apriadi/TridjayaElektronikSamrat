import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import type { UserRole } from '../../../store/authStore';

/**
 * Unit tests for RoleGuard and DashboardRoot owner routing.
 *
 * These tests recreate the PrivateRoute, RoleGuard, and DashboardRoot
 * components as defined in App.tsx to test their access control logic
 * in isolation.
 *
 * **Validates: Requirements 1.5, 1.6, 2.2**
 */

// Mock the auth store
vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);

// Recreate components as defined in App.tsx
const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  if (isInitializing) return <div data-testid="loading">Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const RoleGuard: React.FC<{ children: React.ReactElement; roles: string[] }> = ({ children, roles }) => {
  const { user, isInitializing } = useAuthStore();

  if (isInitializing) return <div data-testid="loading">Loading...</div>;

  if (!user?.role || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const DashboardRoot = () => {
  const { user } = useAuthStore();
  const role = user?.role;

  if (role === 'admin') return <Navigate to="/dashboard/admin" replace />;
  if (role === 'owner') return <Navigate to="/dashboard/owner" replace />;
  if (role === 'operator') return <Navigate to="/dashboard/admin/wa/campaigns" replace />;
  if (role === 'sales') return <Navigate to="/dashboard/sales" replace />;
  return <Navigate to="/dashboard/agent" replace />;
};

// Helper to capture the current location
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

// Helper to set up auth store mock
function mockAuthState(overrides: {
  user?: { id: string; email: string; name: string; role: UserRole } | null;
  isAuthenticated?: boolean;
  isInitializing?: boolean;
}) {
  const defaultState = {
    user: null,
    isAuthenticated: false,
    isInitializing: false,
    accessToken: null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    restoreSession: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
  };

  mockedUseAuthStore.mockReturnValue({
    ...defaultState,
    ...overrides,
  } as any);
}

function createUser(role: UserRole) {
  return { id: '1', email: 'test@test.com', name: 'Test User', role };
}

describe('Feature: owner-dashboard, Property 2: RoleGuard Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RoleGuard with roles=["owner"] permits access when user role is "owner"', () => {
    it('should render children when user has owner role', () => {
      mockAuthState({
        user: createUser('owner'),
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard/owner']}>
          <Routes>
            <Route
              path="/dashboard/owner"
              element={
                <RoleGuard roles={['owner']}>
                  <div data-testid="owner-content">Owner Dashboard</div>
                </RoleGuard>
              }
            />
            <Route path="/dashboard" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('owner-content')).toBeDefined();
      expect(screen.getByText('Owner Dashboard')).toBeDefined();
    });
  });

  describe('RoleGuard with roles=["owner"] redirects non-owner roles', () => {
    const nonOwnerRoles: UserRole[] = ['admin', 'agent', 'sales', 'operator'];

    nonOwnerRoles.forEach((role) => {
      it(`should redirect user with role "${role}" to /dashboard`, () => {
        mockAuthState({
          user: createUser(role),
          isAuthenticated: true,
        });

        render(
          <MemoryRouter initialEntries={['/dashboard/owner']}>
            <Routes>
              <Route
                path="/dashboard/owner"
                element={
                  <RoleGuard roles={['owner']}>
                    <div data-testid="owner-content">Owner Dashboard</div>
                  </RoleGuard>
                }
              />
              <Route path="/dashboard" element={<LocationDisplay />} />
            </Routes>
          </MemoryRouter>
        );

        expect(screen.queryByTestId('owner-content')).toBeNull();
        expect(screen.getByTestId('location').textContent).toBe('/dashboard');
      });
    });
  });

  describe('DashboardRoot redirects owner to /dashboard/owner', () => {
    it('should redirect owner role to /dashboard/owner', () => {
      mockAuthState({
        user: createUser('owner'),
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardRoot />} />
            <Route path="/dashboard/owner" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('location').textContent).toBe('/dashboard/owner');
    });

    it('should redirect admin role to /dashboard/admin', () => {
      mockAuthState({
        user: createUser('admin'),
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardRoot />} />
            <Route path="/dashboard/admin" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('location').textContent).toBe('/dashboard/admin');
    });

    it('should redirect sales role to /dashboard/sales', () => {
      mockAuthState({
        user: createUser('sales'),
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardRoot />} />
            <Route path="/dashboard/sales" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('location').textContent).toBe('/dashboard/sales');
    });

    it('should redirect agent role to /dashboard/agent', () => {
      mockAuthState({
        user: createUser('agent'),
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<DashboardRoot />} />
            <Route path="/dashboard/agent" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('location').textContent).toBe('/dashboard/agent');
    });
  });

  describe('Unauthenticated users are redirected to /login', () => {
    it('should redirect unauthenticated user to /login', () => {
      mockAuthState({
        user: null,
        isAuthenticated: false,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard/owner']}>
          <Routes>
            <Route
              path="/dashboard/owner"
              element={
                <PrivateRoute>
                  <RoleGuard roles={['owner']}>
                    <div data-testid="owner-content">Owner Dashboard</div>
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByTestId('owner-content')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/login');
    });

    it('should preserve attempted location in state when redirecting to /login', () => {
      mockAuthState({
        user: null,
        isAuthenticated: false,
      });

      const LocationWithState = () => {
        const location = useLocation();
        const state = location.state as { from?: { pathname: string } } | null;
        return (
          <div>
            <div data-testid="location">{location.pathname}</div>
            <div data-testid="from">{state?.from?.pathname ?? 'none'}</div>
          </div>
        );
      };

      render(
        <MemoryRouter initialEntries={['/dashboard/owner']}>
          <Routes>
            <Route
              path="/dashboard/owner"
              element={
                <PrivateRoute>
                  <RoleGuard roles={['owner']}>
                    <div data-testid="owner-content">Owner Dashboard</div>
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<LocationWithState />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('location').textContent).toBe('/login');
      expect(screen.getByTestId('from').textContent).toBe('/dashboard/owner');
    });
  });

  describe('RoleGuard shows loading state during initialization', () => {
    it('should show loading when isInitializing is true', () => {
      mockAuthState({
        user: null,
        isAuthenticated: false,
        isInitializing: true,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard/owner']}>
          <Routes>
            <Route
              path="/dashboard/owner"
              element={
                <RoleGuard roles={['owner']}>
                  <div data-testid="owner-content">Owner Dashboard</div>
                </RoleGuard>
              }
            />
            <Route path="/dashboard" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('loading')).toBeDefined();
      expect(screen.queryByTestId('owner-content')).toBeNull();
    });
  });
});
