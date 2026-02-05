import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/lib/query-client";

function getExternalApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://er-emr-backend.onrender.com/api";
  return apiUrl;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokenExpired?: boolean;
}

// Callback for when token expires - will be set by AuthContext
let onTokenExpiredCallback: (() => void) | null = null;

export function setOnTokenExpiredCallback(callback: () => void) {
  onTokenExpiredCallback = callback;
}

async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem("token");
}

function isTokenExpiredError(errorMessage: string, statusCode: number): boolean {
  const expiredMessages = ["token expired", "jwt expired", "token invalid", "unauthorized", "not authenticated"];
  const lowerError = errorMessage.toLowerCase();
  return statusCode === 401 || expiredMessages.some(msg => lowerError.includes(msg));
}

async function handleTokenExpiry() {
  console.log("[API] Token expired, clearing auth state");
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("user");
  queryClient.clear();
  if (onTokenExpiredCallback) {
    onTokenExpiredCallback();
  }
}

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage: string = "Request failed";
    let errorData: any = null;
    try {
      const errorJson = JSON.parse(errorText);
      errorData = errorJson;
      const rawError = errorJson.detail || errorJson.message || errorJson.error || errorText;
      errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
    } catch {
      errorMessage = errorText || res.statusText;
    }
    
    // Check for token expiry
    if (isTokenExpiredError(errorMessage, res.status)) {
      await handleTokenExpiry();
      return { success: false, error: "Your session has expired. Please log in again.", tokenExpired: true };
    }
    
    // Return full error data if available for better debugging
    return { success: false, error: errorData || errorMessage };
  }
  const data = await res.json();
  
  // Also check for token expired in successful response body (some APIs do this)
  if (data && typeof data === 'object' && data.error) {
    const errorStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    if (isTokenExpiredError(errorStr, 200)) {
      await handleTokenExpiry();
      return { success: false, error: "Your session has expired. Please log in again.", tokenExpired: true };
    }
  }
  
  return { success: true, data };
}

export async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const apiUrl = getExternalApiUrl();
  const token = await getToken();
  const res = await fetch(`${apiUrl}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = "Request failed";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.message || errorText;
    } catch {
      errorMessage = errorText || res.statusText;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiPost<T>(
  endpoint: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    console.log(`[API] POST ${endpoint}, has token: ${!!token}, token length: ${token?.length || 0}`);
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await handleResponse<T>(res);
    console.log(`[API] POST ${endpoint} response:`, result.success, result.error || '');
    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiPatch<T>(
  endpoint: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiPut<T>(
  endpoint: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function invalidateCases() {
  return queryClient.invalidateQueries({ queryKey: ["cases"] });
}

export async function invalidateCase(caseId: string) {
  return queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
}

export { getExternalApiUrl };
