/**
 * ==============================================================================
 * TEREKA FINANCIAL INTELLIGENCE - AUTHENTICATION CONTEXT & STATE PROVIDER
 * ==============================================================================
 * 
 * This file manages the client-side authentication lifecycle, JWT token
 * persistence in localStorage, user profile hydration, and session restoration.
 * 
 * Key Roles:
 * 1. Global Token Getter: Intercepts API requests and attaches `Bearer <token>`
 * 2. Session Initialization: Restores user state from `/api/me` on browser load
 * 3. Auth Actions: `login()`, `register()`, `logout()`, `refreshUser()`
 * 4. React Context Hook: `useAuth()` hook for accessing current session across UI
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

/**
 * Basic authenticated user identity returned by the API
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  baseCurrency: 'UGX' | 'KES' | 'TZS' | 'RWF' | 'USD';
}

/**
 * Extended user profile including regional and visual preferences
 */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  country: string;
  preferredCurrency: 'UGX' | 'KES' | 'TZS' | 'RWF' | 'USD';
  theme: 'light' | 'dark' | 'system';
}

/**
 * Shape of the AuthContext exposed to consuming components
 */
interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, baseCurrency?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Key name used for persisting the JWT authentication token in localStorage
 */
const TOKEN_KEY = 'tereka_auth_token';

/**
 * Configure the global API client (`@workspace/api-client-react`) so every
 * generated API hook automatically attaches the active Authorization Bearer token.
 */
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

/**
 * Top-level AuthProvider component wrapping the React application tree
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Read token from localStorage on initial render
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Validates the stored JWT token with the backend and fetches user profile
   */
  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Unauthorized or expired session');
      }

      const data = await res.json();
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        baseCurrency: data.baseCurrency,
      });
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch {
      // If token is invalid or expired, clear stale credentials
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Run once on mount: Check for existing session token
   */
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);

  /**
   * Log into an existing account with email and password
   */
  const login = async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign in');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
    }
  };

  /**
   * Register a new account with starter PostgreSQL records
   */
  const register = async (name: string, email: string, password: string, baseCurrency?: string) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, baseCurrency: baseCurrency || 'UGX' }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create account');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
    }
  };

  /**
   * Clear session token and reset state
   */
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  /**
   * Re-fetches the latest user data from the backend
   */
  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom React hook for consuming authentication state
 * 
 * Usage in components:
 * ```tsx
 * const { user, isAuthenticated, logout } = useAuth();
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
