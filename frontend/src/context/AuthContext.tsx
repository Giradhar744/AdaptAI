import React, { createContext, useContext, useState, useEffect } from 'react';

export interface DisabilityInfo {
  code: string;
  label: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'student' | 'teacher' | 'parent';
  display_name: string;
  is_active: boolean;
  student_id?: string | null;
  teacher_id?: string | null;
  age?: number | null;
  age_band?: string | null;
  disabilities?: DisabilityInfo[];
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'parent';
  display_name: string;
  age?: number;
  disability_type_code?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'adaptai_access_token';
const USER_KEY = 'adaptai_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const hasToken = !!localStorage.getItem(TOKEN_KEY);
    const hasUser = !!localStorage.getItem(USER_KEY);
    return hasToken && !hasUser;
  });

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      } else if (res.status === 401 || res.status === 403) {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      }
    } catch {
      // Keep cached user on network glitch
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && !user) {
      fetchProfile(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setIsLoading(false);
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid email or password.');
    }

    const data = await res.json();
    const accessToken = data.access_token;
    localStorage.setItem(TOKEN_KEY, accessToken);

    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsLoading(false);
    }
    setToken(accessToken);
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setIsLoading(false);
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed. Please check your details.');
    }

    const data = await res.json();
    const accessToken = data.access_token;
    localStorage.setItem(TOKEN_KEY, accessToken);

    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsLoading(false);
    }
    setToken(accessToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('adaptai_active_view');
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
