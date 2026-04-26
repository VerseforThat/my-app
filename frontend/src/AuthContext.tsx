import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Storage from './storage';
import { api, TOKEN_KEY, User, AuthResponse, formatError } from './api';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await Storage.getItem(TOKEN_KEY);
        if (token) {
          const res = await api.get('/auth/me');
          setUser(res.data);
        }
      } catch {
        await Storage.deleteItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signup = async (email: string, password: string, name?: string) => {
    try {
      const res = await api.post<AuthResponse>('/auth/signup', { email, password, name });
      await Storage.setItem(TOKEN_KEY, res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatError(e));
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      await Storage.setItem(TOKEN_KEY, res.data.access_token);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(formatError(e));
    }
  };

  const logout = async () => {
    await Storage.deleteItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
