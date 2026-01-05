import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost, apiGet } from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  hospital?: string;
  subscription_plan?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  hospital?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Error loading stored auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await apiPost<{ access_token: string; user: User }>("/auth/login", {
        email,
        password,
      });

      if (res.success && res.data) {
        const { access_token, user: userData } = res.data;
        await AsyncStorage.setItem("token", access_token);
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        setToken(access_token);
        setUser(userData);
        return { success: true };
      }

      return { success: false, error: res.error || "Login failed" };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await apiPost<{ access_token: string; user: User }>("/auth/register", data);

      if (res.success && res.data) {
        const { access_token, user: userData } = res.data;
        await AsyncStorage.setItem("token", access_token);
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        setToken(access_token);
        setUser(userData);
        return { success: true };
      }

      return { success: false, error: res.error || "Registration failed" };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const res = await apiGet<User>("/auth/me");
      if (res.success && res.data) {
        setUser(res.data);
        await AsyncStorage.setItem("user", JSON.stringify(res.data));
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
