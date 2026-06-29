import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost, apiGet, setOnTokenExpiredCallback } from "@/lib/api";
import { getApiUrl, queryClient } from "@/lib/query-client";

// Store credentials server-side (encrypted) so the app can silently re-login
// when the external token expires. Only the non-sensitive session_token is kept on device.
async function storeCredsForSilentRefresh(email: string, password: string, userId?: string) {
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/api/auth/store-creds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.session_token) {
        await AsyncStorage.setItem("session_token", data.session_token);
        console.log("[AuthContext] Silent-refresh session stored");
      }
    }
  } catch (e) {
    console.warn("[AuthContext] Could not store silent-refresh session:", e);
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  hospital?: string;
  subscription_plan?: string;
}

export type AuthMethod = "email" | "google" | null;

interface AuthContextType {
  user: User | null;
  token: string | null;
  authMethod: AuthMethod;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  googleSignIn: (params: { name: string; email: string; idToken?: string; accessToken?: string; password?: string }) => Promise<{ success: boolean; error?: string; accountExists?: boolean }>;
  loginWithToken: (authToken: string, userData: User) => Promise<void>;
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
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
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
      const storedMethod = await AsyncStorage.getItem("auth_method") as AuthMethod;
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      if (storedMethod) setAuthMethod(storedMethod);
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
      await AsyncStorage.removeItem("refresh_token");
      await AsyncStorage.removeItem("user");

      // Route through our proxy so cold-start retries are handled server-side
      const baseUrl = getApiUrl();
      const rawRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      const json = await rawRes.json().catch(() => ({}));
      const res = rawRes.ok
        ? { success: true, data: json as { access_token: string; refresh_token?: string; user: User } }
        : { success: false, error: json?.error || json?.detail || "Login failed" };

      console.log("[AuthContext] Login response:", res.success, res.error);

      if (res.success && res.data) {
        const { access_token, refresh_token, user: userData } = res.data;
        console.log("[AuthContext] Got new token, length:", access_token?.length);
        queryClient.clear();
        await AsyncStorage.setItem("token", access_token);
        if (refresh_token) {
          await AsyncStorage.setItem("refresh_token", refresh_token);
          console.log("[AuthContext] Refresh token stored");
        }
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        await AsyncStorage.setItem("auth_method", "email");
        setToken(access_token);
        setUser(userData);
        setAuthMethod("email");
        // Store encrypted credentials server-side for silent re-login when token expires
        storeCredsForSilentRefresh(email, password, userData.id).catch(() => {});
        return { success: true };
      }

      return { success: false, error: res.error || "Login failed" };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      // Route through our proxy so we can handle welcome-email failures gracefully
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await response.json().catch(() => ({}));

      if (response.ok && json.access_token) {
        const { access_token, refresh_token, user: userData } = json;
        queryClient.clear();
        await AsyncStorage.setItem("token", access_token);
        if (refresh_token) await AsyncStorage.setItem("refresh_token", refresh_token);
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        setToken(access_token);
        setUser(userData);
        return { success: true };
      }

      const errorMsg = json.error || json.detail || json.message || "Registration failed";
      return { success: false, error: errorMsg };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const googleSignIn = async (params: { name: string; email: string; idToken?: string; accessToken?: string; password?: string }) => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("refresh_token");
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

      queryClient.clear();
      const { access_token, refresh_token, user: userData } = data;

      if (access_token && userData) {
        await AsyncStorage.setItem("token", access_token);
        if (refresh_token) {
          await AsyncStorage.setItem("refresh_token", refresh_token);
        }
        await AsyncStorage.setItem("user", JSON.stringify(userData));
        await AsyncStorage.setItem("auth_method", "google");
        setToken(access_token);
        setUser(userData);
        setAuthMethod("google");
        return { success: true };
      }

      return { success: false, error: "Invalid response from server" };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const loginWithToken = async (authToken: string, userData: User) => {
    queryClient.clear();
    await AsyncStorage.setItem("token", authToken);
    await AsyncStorage.setItem("user", JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("refresh_token");
      await AsyncStorage.removeItem("session_token");
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("auth_method");
      queryClient.clear();
      setToken(null);
      setUser(null);
      setAuthMethod(null);
    } catch (error) {
      console.error("[AuthContext] Logout error:", error);
      queryClient.clear();
      setToken(null);
      setUser(null);
      setAuthMethod(null);
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
        authMethod,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        googleSignIn,
        loginWithToken,
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
