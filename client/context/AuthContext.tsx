import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost, apiGet, setOnTokenExpiredCallback } from "@/lib/api";
import { getApiUrl, queryClient } from "@/lib/query-client";

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
  googleSignIn: (params: { name: string; email: string; idToken?: string; accessToken?: string; password?: string }) => Promise<{ success: boolean; error?: string; accountExists?: boolean }>;
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

  // Handle token expiry callback from API layer
  const handleTokenExpired = useCallback(() => {
    console.log("[AuthContext] Token expired, logging out user");
    queryClient.clear();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Register the token expired callback
    setOnTokenExpiredCallback(handleTokenExpired);
    loadStoredAuth();
  }, [handleTokenExpired]);

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
      // Clear any old tokens first
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      
      const res = await apiPost<{ access_token: string; user: User }>("/auth/login", {
        email,
        password,
      });

      console.log("[AuthContext] Login response:", res.success, res.error);

      if (res.success && res.data) {
        const { access_token, user: userData } = res.data;
        console.log("[AuthContext] Got new token, length:", access_token?.length);
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

  const googleSignIn = async (params: { name: string; email: string; idToken?: string; accessToken?: string; password?: string }) => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");

      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMsg = "Google sign-in failed";
        let accountExists = false;
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.error || errData.message || errorMsg;
          if (errorMsg.toLowerCase().includes("already exists") || errorMsg.toLowerCase().includes("already registered")) {
            accountExists = true;
          }
        } catch {
          if (responseText.trim().startsWith("<")) {
            errorMsg = "Server is temporarily unavailable. Please try again in a moment.";
          }
        }
        return { success: false, error: errorMsg, accountExists };
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, error: "Server returned an unexpected response. Please try again." };
      }

      const { access_token, user: userData } = data;

      if (access_token && userData) {
        await AsyncStorage.setItem("token", access_token);
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        setToken(access_token);
        setUser(userData);
        return { success: true };
      }

      return { success: false, error: "Invalid response from server" };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      queryClient.clear();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("[AuthContext] Logout error:", error);
      queryClient.clear();
      setToken(null);
      setUser(null);
    }
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
        googleSignIn,
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
