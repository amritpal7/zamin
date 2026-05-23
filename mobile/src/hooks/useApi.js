import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";

const BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";

/**
 * useApi() — returns a typed api object.
 * Clerk's getToken() is called automatically on every authenticated request.
 *
 * Usage:
 *   const api = useApi();
 *   const properties = await api.getProperties({ type: "House" });
 */
export function useApi() {
  const { getToken } = useAuth();

  const request = async (path, options = {}) => {
    const token = await getToken();
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  };

  return {
    // Properties
    getProperties: (params = {}) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "All")).toString();
      return request(`/properties${q ? `?${q}` : ""}`);
    },
    getProperty: (id) => request(`/properties/${id}`),
    createProperty: (data) => request("/properties", { method: "POST", body: JSON.stringify(data) }),
    deleteProperty: (id) => request(`/properties/${id}`, { method: "DELETE" }),

    // Saved
    getSaved: () => request("/saved"),
    saveProperty: (id) => request(`/saved/${id}`, { method: "POST" }),
    unsaveProperty: (id) => request(`/saved/${id}`, { method: "DELETE" }),

    // Messages
    getMessages: (propertyId) => request(`/messages/${propertyId}`),
    sendMessage: (propertyId, text, receiver_id) =>
      request(`/messages/${propertyId}`, { method: "POST", body: JSON.stringify({ text, receiver_id }) }),
  };
}
