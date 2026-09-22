'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { User, UserProfile, UserMetadata } from '@/types/auth.types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: UserMetadata) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  updateProfile: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const convex = useConvex();

  // Get session token from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch user data when token is available
  useEffect(() => {
    if (!token) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const verifyAndFetchUser = async () => {
      try {
        // Verify session
        const sessionResult = await convex.action(api.actions.auth.verifySession, {
          token,
        });

        if (!sessionResult.valid || !sessionResult.user) {
          // Invalid or expired session
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(sessionResult.user);
        setProfile(sessionResult.profile ?? null);
      } catch (error) {
        console.error('Error verifying session:', error);
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAndFetchUser();
  }, [token, convex]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await convex.action(api.actions.auth.signIn, {
        email,
        password,
      });

      if (result.error) {
        return { error: new Error(result.error) };
      }

      if (result.token) {
        localStorage.setItem('auth_token', result.token);
        setToken(result.token);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: UserMetadata) => {
    try {
      setLoading(true);
      const result = await convex.action(api.actions.auth.signUp, {
        email,
        password,
        metadata,
      });

      if (result.error) {
        return { error: new Error(result.error) };
      }

      if (result.token) {
        localStorage.setItem('auth_token', result.token);
        setToken(result.token);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (token) {
        await convex.action(api.actions.auth.signOut, {
          token,
        });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      setProfile(null);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user || !token) {
        return { error: new Error('No user logged in') };
      }

      const result = await convex.action(api.actions.auth.updateMyProfile, {
        token,
        company: updates.company,
        phone: updates.phone,
      });
      if (result.error) {
        return { error: new Error(result.error) };
      }
      setProfile(result.profile ?? null);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};





