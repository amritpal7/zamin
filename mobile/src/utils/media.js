// Resolve stored image URLs against the CURRENT API base.
//
// In dev, uploads are stored as absolute URLs using whatever host the app talked to at upload
// time (e.g. http://192.168.29.228/api/media/properties/<id>.jpg). When the LAN IP changes, or a
// listing is viewed from the emulator (10.0.2.2) or another device, that host is unreachable and
// the photo never loads. Any `/media/...` URL (dev nginx → MinIO) is therefore rebuilt on the
// current base. Prod URLs are absolute MinIO URLs (`…/zamin/properties/…`) and pass through.
import Constants from "expo-constants";

const BASE = Constants.expoConfig?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_API_URL
  || "http://localhost/api";

const MEDIA = /^(?:https?:\/\/[^/]+)?(?:\/api)?(\/media\/.+)$/;

export function resolveMediaUrl(uri) {
  if (typeof uri !== "string") return uri;
  const m = uri.match(MEDIA);
  return m ? `${BASE.replace(/\/$/, "")}${m[1]}` : uri;
}
