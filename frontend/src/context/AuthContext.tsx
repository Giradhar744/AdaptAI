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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
      } else {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
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
    setToken(accessToken);
    await fetchProfile(accessToken);
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
    setToken(accessToken);
    await fetchProfile(accessToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
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
