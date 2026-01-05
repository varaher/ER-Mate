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
}

async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem("token");
}

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = "Request failed";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.message || errorText;
    } catch {
      errorMessage = errorText || res.statusText;
    }
    return { success: false, error: errorMessage };
  }
  const data = await res.json();
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
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
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
