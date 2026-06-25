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
  const delays = [0, 3000, 6000, 10000];

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
  onStatus?.("");
  console.log("[API] Warmup gave up — login will proceed anyway");
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokenExpired?: boolean;
}

// Callback for when token is fully expired and refresh failed
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

// ─── JWT Proactive Expiry Check ──────────────────────────────────────────────

function getTokenExpirySec(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    let json: string;
    if (typeof atob !== "undefined") {
      json = atob(b64);
    } else {
      json = Buffer.from(b64, "base64").toString("utf-8");
    }
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTokenNearExpiry(token: string, bufferSeconds = 300): boolean {
  const exp = getTokenExpirySec(token);
  if (exp === null) return false;
  return Math.floor(Date.now() / 1000) >= exp - bufferSeconds;
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

// Concurrency lock: if multiple calls fail simultaneously, only one refresh runs
let _refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (_refreshPromise) {
    return _refreshPromise;
  }
  _refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem("refresh_token");
      if (!refreshToken) {
        console.log("[API] No refresh_token stored — cannot refresh");
        return null;
      }
      const apiUrl = getExternalApiUrl();
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        console.log("[API] Refresh endpoint returned", res.status);
        return null;
      }
      const data = await res.json();
      const newToken = data.access_token;
      if (!newToken) return null;
      await AsyncStorage.setItem("token", newToken);
      if (data.refresh_token) {
        await AsyncStorage.setItem("refresh_token", data.refresh_token);
      }
      console.log("[API] Token refreshed silently");
      return newToken;
    } catch (e) {
      console.log("[API] tryRefreshToken error:", e);
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// Get a valid token, proactively refreshing if expiry is within 5 minutes
async function getValidToken(): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  if (isTokenNearExpiry(token, 300)) {
    console.log("[API] Token near expiry — proactively refreshing");
    const newToken = await tryRefreshToken();
    return newToken ?? token;
  }
  return token;
}

// Full logout after refresh fails
async function handleLogout() {
  console.log("[API] Token refresh failed — logging out");
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("refresh_token");
  await AsyncStorage.removeItem("user");
  queryClient.clear();
  onTokenExpiredCallback?.();
}

// Wraps any fetch call: retries once with a fresh token on 401, then logs out
type RequestFn = (token: string | null) => Promise<Response>;

async function withTokenRefresh(makeFetch: RequestFn): Promise<Response> {
  const token = await getValidToken();
  const res = await makeFetch(token);

  if (res.status === 401 && token) {
    console.log("[API] 401 received — attempting silent token refresh");
    const newToken = await tryRefreshToken();
    if (newToken) {
      console.log("[API] Retrying request with fresh token");
      return makeFetch(newToken);
    }
    // Refresh failed — clear session; caller will see the 401 response
    await handleLogout();
  }

  return res;
}

// ─── Response Parser ──────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const responseText = await res.text();

  if (!res.ok) {
    let errorMessage: string = "Request failed";
    try {
      const errorJson = JSON.parse(responseText);
      const rawError = errorJson.detail || errorJson.message || errorJson.error || responseText;
      if (typeof rawError === "string") {
        errorMessage = rawError;
      } else if (typeof rawError === "object" && rawError !== null) {
        errorMessage = rawError.message || rawError.detail || (typeof rawError.error === "string" ? rawError.error : JSON.stringify(rawError));
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

    // If still 401 here, refresh already failed (handleLogout was called by withTokenRefresh)
    if (res.status === 401) {
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

  if (data && typeof data === "object" && data.error) {
    const errorStr = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (isTokenExpiredError(errorStr, 200)) {
      await handleLogout();
      return { success: false, error: "Your session has expired. Please log in again.", tokenExpired: true };
    }
  }

  return { success: true, data };
}

// ─── Public API Functions ─────────────────────────────────────────────────────

export async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const apiUrl = getExternalApiUrl();
  const res = await withTokenRefresh((tok) =>
    fetch(`${apiUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
    })
  );

  if (!res.ok) {
    const responseText = await res.text();
    let errorMessage = "Request failed";
    try {
      const errorJson = JSON.parse(responseText);
      errorMessage = errorJson.detail || errorJson.message || errorJson.error || responseText;
      if (typeof errorMessage !== "string") errorMessage = JSON.stringify(errorMessage);
    } catch {
      if (responseText.trim().startsWith("<") || responseText.includes("<!DOCTYPE")) {
        errorMessage = "Server is temporarily unavailable. Please try again in a moment.";
      } else {
        errorMessage = responseText || res.statusText;
      }
    }
    if (res.status === 401) {
      throw new Error("Your session has expired. Please log in again.");
    }
    throw new Error(errorMessage);
  }

  try {
    return res.json();
  } catch {
    throw new Error("Server returned an unexpected response. It may be restarting — please try again.");
  }
}

export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const res = await withTokenRefresh((tok) =>
      fetch(`${apiUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
      })
    );
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
    console.log(`[API] POST ${endpoint}`);
    const res = await withTokenRefresh((tok) =>
      fetchWithTimeout(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      }, timeoutMs)
    );
    const result = await handleResponse<T>(res);
    console.log(`[API] POST ${endpoint} response:`, result.success, result.error || "");
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
    const res = await withTokenRefresh((tok) =>
      fetch(`${apiUrl}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      })
    );
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
    const res = await withTokenRefresh((tok) =>
      fetch(`${apiUrl}${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      })
    );
    return handleResponse<T>(res);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getExternalApiUrl();
    const res = await withTokenRefresh((tok) =>
      fetch(`${apiUrl}${endpoint}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
      })
    );
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
    const res = await withTokenRefresh((tok) =>
      fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: formData,
      })
    );
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
  const proxyUrl = new URL("/api/proxy/cases", getApiUrl()).href;
  const res = await withTokenRefresh((tok) =>
    fetch(proxyUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
    })
  );
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Your session has expired. Please log in again.");
    }
    const text = await res.text();
    let errorMessage = text || "Failed to fetch cases";
    try {
      const errJson = JSON.parse(text);
      const raw = errJson.detail || errJson.message || errJson.error;
      if (raw && typeof raw === "string") errorMessage = raw;
    } catch { /* keep raw text */ }
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function fetchCaseByIdFromProxy(caseId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const proxyUrl = new URL(`/api/proxy/cases/${caseId}`, getApiUrl()).href;
    const res = await withTokenRefresh((tok) =>
      fetch(proxyUrl, {
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
      })
    );
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
  const proxyUrl = new URL(`/api/proxy/cases/${caseId}`, getApiUrl()).href;
  const res = await withTokenRefresh((tok) =>
    fetch(proxyUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
    })
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete case");
  }
}

export async function saveClinicalDataToServer(caseId: string, payload: any): Promise<void> {
  try {
    const proxyUrl = new URL(`/api/proxy/clinical-data/${caseId}`, getApiUrl()).href;
    await withTokenRefresh((tok) =>
      fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify(payload),
      })
    );
  } catch (err) {
    console.warn("[API] saveClinicalDataToServer failed (non-blocking):", err);
  }
}

export async function getClinicalDataFromServer(caseId: string): Promise<any | null> {
  try {
    const proxyUrl = new URL(`/api/proxy/clinical-data/${caseId}`, getApiUrl()).href;
    const res = await withTokenRefresh((tok) =>
      fetch(proxyUrl, {
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
      })
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data.payload : null;
  } catch (err) {
    console.warn("[API] getClinicalDataFromServer failed:", err);
    return null;
  }
}

export { getExternalApiUrl };
