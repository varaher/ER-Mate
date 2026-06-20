import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient, getApiUrl } from "@/lib/query-client";

function getExternalApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "https://er-emr-backend.onrender.com/api";
  return apiUrl;
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("The server is taking too long to respond. Please try again."));
    }, timeoutMs);
    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch((err) => {
        if (err.name === "AbortError") {
          reject(new Error("The server is taking too long to respond. Please try again."));
        } else {
          reject(err);
        }
      })
      .finally(() => clearTimeout(timer));
  });
}

export async function warmUpBackend(
  onStatus?: (msg: string) => void
): Promise<void> {
  const apiUrl = getExternalApiUrl();
  const maxAttempts = 4;
  const delays = [0, 3000, 6000, 10000]; // 0s, 3s, 6s, 10s

  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) {
      await new Promise((r) => setTimeout(r, delays[i]));
    }
    try {
      onStatus?.(i === 0 ? "Connecting…" : "Still connecting…");
      const res = await fetch(`${apiUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok || res.status < 500) {
        onStatus?.("");
        console.log(`[API] Backend warm after ${i + 1} attempt(s)`);
        return;
      }
    } catch {
      // network error or timeout — retry
    }
    console.log(`[API] Warmup attempt ${i + 1} failed, retrying…`);
  }
  onStatus?.(""); // clear status — let login proceed anyway
  console.log("[API] Warmup gave up — login will proceed anyway");
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
  const responseText = await res.text();
  
  if (!res.ok) {
    let errorMessage: string = "Request failed";
    try {
      const errorJson = JSON.parse(responseText);
      const rawError = errorJson.detail || errorJson.message || errorJson.error || responseText;
      if (typeof rawError === 'string') {
        errorMessage = rawError;
      } else if (typeof rawError === 'object' && rawError !== null) {
        errorMessage = rawError.message || rawError.detail || (typeof rawError.error === 'string' ? rawError.error : JSON.stringify(rawError));
      } else {
        errorMessage = JSON.stringify(rawError);
      }
    } catch {
      if (responseText.trim().startsWith("<") || responseText.includes("<!DOCTYPE")) {
        errorMessage = "Server is temporarily unavailable. Please try again in a moment.";
      } else {
        errorMessage = responseText || res.statusText;
      }
    }
    
    const currentToken = await getToken();
    if (currentToken && isTokenExpiredError(errorMessage, res.status)) {
      await handleTokenExpiry();
      return { success: false, error: "Your session has expired. Please log in again.", tokenExpired: true };
    }
    
    return { success: false, error: errorMessage };
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    if (responseText.trim().startsWith("<") || responseText.includes("<!DOCTYPE")) {
      return { success: false, error: "Server returned an unexpected response. It may be restarting — please try again in a moment." };
    }
    return { success: false, error: "Server returned an invalid response." };
  }
  
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

  const responseText = await res.text();

  if (!res.ok) {
    let errorMessage = "Request failed";
    try {
      const errorJson = JSON.parse(responseText);
      errorMessage = errorJson.detail || errorJson.message || responseText;
    } catch {
      if (responseText.trim().startsWith("<") || responseText.includes("<!DOCTYPE")) {
        errorMessage = "Server is temporarily unavailable. Please try again in a moment.";
      } else {
        errorMessage = responseText || res.statusText;
      }
    }
    throw new Error(errorMessage);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Server returned an unexpected response. It may be restarting — please try again.");
  }
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
  data?: unknown,
  timeoutMs: number = 30000
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const token = await getToken();
    console.log(`[API] POST ${endpoint}, has token: ${!!token}, token length: ${token?.length || 0}`);
    const res = await fetchWithTimeout(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
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

export async function fetchCasesFromProxy<T = any[]>(): Promise<T> {
  const token = await getToken();
  const proxyUrl = new URL("/api/proxy/cases", getApiUrl()).href;
  const res = await fetch(proxyUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch cases");
  }
  return res.json();
}

export async function fetchCaseByIdFromProxy(caseId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = await getToken();
    const proxyUrl = new URL(`/api/proxy/cases/${caseId}`, getApiUrl()).href;
    const res = await fetch(proxyUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCaseFromProxy(caseId: string): Promise<void> {
  const token = await getToken();
  const proxyUrl = new URL(`/api/proxy/cases/${caseId}`, getApiUrl()).href;
  const res = await fetch(proxyUrl, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete case");
  }
}

export async function saveClinicalDataToServer(caseId: string, payload: any): Promise<void> {
  try {
    const token = await getToken();
    const proxyUrl = new URL(`/api/proxy/clinical-data/${caseId}`, getApiUrl()).href;
    await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[API] saveClinicalDataToServer failed (non-blocking):", err);
  }
}

export async function getClinicalDataFromServer(caseId: string): Promise<any | null> {
  try {
    const token = await getToken();
    const proxyUrl = new URL(`/api/proxy/clinical-data/${caseId}`, getApiUrl()).href;
    const res = await fetch(proxyUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data.payload : null;
  } catch (err) {
    console.warn("[API] getClinicalDataFromServer failed:", err);
    return null;
  }
}

export { getExternalApiUrl };
