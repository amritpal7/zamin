import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { useCallback, useMemo } from "react";
import { rememberLocal } from "../utils/imageCache";

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

    // Image upload — presigned DIRECT-to-storage. Bytes never touch the API:
    // 1) get signed URLs, 2) PUT each file straight to storage, 3) tell the API
    // to enqueue background resize. Returns [{ url, thumb }].
    uploadImages: async (uris) => {
      if (!uris?.length) return [];
      const token = await getToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      // 1) signed upload URLs
      const presignRes = await fetch(`${BASE}/properties/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ count: uris.length }),
      });
      if (!presignRes.ok) {
        const e = await presignRes.json().catch(() => ({}));
        throw new Error(e.error || "Could not start upload");
      }
      const { files } = await presignRes.json();

      // 2) upload each file STRAIGHT to object storage
      await Promise.all(uris.map(async (uri, i) => {
        const blob = await (await fetch(uri)).blob();
        const put = await fetch(files[i].uploadUrl, { method: "PUT", body: blob });
        if (!put.ok) throw new Error("Photo upload failed");
      }));

      // 3) enqueue background resize + thumbnail
      await fetch(`${BASE}/properties/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ items: files.map(f => ({ base: f.base, origKey: f.origKey })) }),
      });

      // 4) final URLs + optimistic local mapping
      const abs = (u) => (u.startsWith("http") ? u : `${BASE}${u}`);
      return files.map((f, i) => {
        const url = abs(f.url), thumb = abs(f.thumb);
        rememberLocal(url, uris[i]);
        rememberLocal(thumb, uris[i]);
        return { url, thumb };
      });
    },

    // Messages
    getConversations: () => request("/messages"),
    getMessages: (propertyId, peer) => request(`/messages/${propertyId}${peer ? `?peer=${encodeURIComponent(peer)}` : ""}`),
    sendMessage: (propertyId, text, receiver_id, sender = {}) =>
      request(`/messages/${propertyId}`, { method: "POST", body: JSON.stringify({ text, receiver_id, ...sender }) }),
    markRead: (propertyId, peer) =>
      request(`/messages/${propertyId}/read?peer=${encodeURIComponent(peer)}`, { method: "POST" }),

    // Structured proposals: visit (when) + offer (amount), with accept/decline/counter
    proposeVisit: (propertyId, { receiver_id, when, ...sender }) =>
      request(`/messages/${propertyId}/proposal`, { method: "POST", body: JSON.stringify({ kind: "visit", receiver_id, value: when, ...sender }) }),
    proposeOffer: (propertyId, { receiver_id, amount, ...sender }) =>
      request(`/messages/${propertyId}/proposal`, { method: "POST", body: JSON.stringify({ kind: "offer", receiver_id, value: amount, ...sender }) }),
    respondProposal: (messageId, status) =>
      request(`/messages/proposal/${messageId}/respond`, { method: "POST", body: JSON.stringify({ status }) }),
    counterProposal: (messageId, { value, ...sender }) =>
      request(`/messages/proposal/${messageId}/counter`, { method: "POST", body: JSON.stringify({ value, ...sender }) }),

    // Trust & safety
    blockUser: (userId) => request(`/users/${userId}/block`, { method: "POST" }),
    unblockUser: (userId) => request(`/users/${userId}/block`, { method: "DELETE" }),
    getBlockStatus: (userId) => request(`/users/${userId}/block`),
    reportUser: (userId, reason, property_id) =>
      request(`/users/${userId}/report`, { method: "POST", body: JSON.stringify({ reason, property_id }) }),

    // Push notifications
    registerPush: (token) => request("/push/register", { method: "POST", body: JSON.stringify({ token }) }),
    unregisterPush: (token) => request("/push/unregister", { method: "POST", body: JSON.stringify({ token }) }),

    // Notifications store
    getNotifications: () => request("/notifications"),
    markNotificationsRead: () => request("/notifications/read", { method: "POST" }),

    // Saved searches
    createSavedSearch: (body) => request("/saved-searches", { method: "POST", body: JSON.stringify(body) }),
    getSavedSearches: () => request("/saved-searches"),
    deleteSavedSearch: (id) => request(`/saved-searches/${id}`, { method: "DELETE" }),

    // Visit scheduling
    createVisit: (property_id, slot, note) =>
      request("/visits", { method: "POST", body: JSON.stringify({ property_id, slot, note }) }),
    getVisits: () => request("/visits"),
    respondVisit: (id, status) =>
      request(`/visits/${id}/respond`, { method: "POST", body: JSON.stringify({ status }) }),
    cancelVisit: (id) => request(`/visits/${id}/cancel`, { method: "POST" }),
  }), [request]);
}
