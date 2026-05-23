import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { useCallback, useMemo } from "react";

const BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";

export function useApi() {
  const { getToken } = useAuth();

  // Stable reference — only recreated if getToken changes (essentially never)
  const request = useCallback(async (path, options = {}) => {
    const token = await getToken();
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    // redirect: "manual" prevents fetch from silently following 302 redirects
    // (Clerk's requireAuth used to redirect to sign-in instead of returning 401,
    //  which caused fetch to receive HTML and fail JSON parsing with no clear error)
    const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...options, headers: { ...headers, ...options.headers } });
    if (!res.ok || res.type === "opaqueredirect") {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || (res.status === 401 ? "Unauthorized" : res.statusText) || "Request failed");
    }
    return res.json();
  }, [getToken]);

  return useMemo(() => ({
    // Properties
    getProperties: (params = {}) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "All")).toString();
      return request(`/properties${q ? `?${q}` : ""}`);
    },
    getProperty: (id) => request(`/properties/${id}`),
    getMyProperties: () => request("/properties/mine"),
    createProperty: (data) => request("/properties", { method: "POST", body: JSON.stringify(data) }),
    updateProperty: (id, data) => request(`/properties/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteProperty: (id) => request(`/properties/${id}`, { method: "DELETE" }),

    // Saved
    getSaved: () => request("/saved"),
    saveProperty: (id) => request(`/saved/${id}`, { method: "POST" }),
    unsaveProperty: (id) => request(`/saved/${id}`, { method: "DELETE" }),

    // Messages
    getMessages: (propertyId) => request(`/messages/${propertyId}`),
    sendMessage: (propertyId, text, receiver_id) =>
      request(`/messages/${propertyId}`, { method: "POST", body: JSON.stringify({ text, receiver_id }) }),
  }), [request]);
}
