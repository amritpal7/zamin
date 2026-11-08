import React from "react";
import { Image } from "expo-image";
import { getLocalForRemote } from "../utils/imageCache";
import { resolveMediaUrl } from "../utils/media";

// Neutral warm blurhash shown while a remote image streams in.
const BLUR_PLACEHOLDER = "L6Pj0^jE.AyE_3t7t7R**0o#DgR4";

// expo-image wrapper: the remote URL is always the source (canonical, cached),
// while a just-uploaded local file shows instantly as the placeholder. This keeps
// the optimistic "instant" feel without ever blanking if the local file is stale.
export default function SmartImage({ uri: rawUri, style, contentFit = "cover", transition = 220 }) {
  const local = rawUri ? getLocalForRemote(rawUri) : null;  // keyed by the stored URL
  const uri = resolveMediaUrl(rawUri);                       // stale dev hosts → current API base
  return (
    <Image
      // Canonical object form. A bare string source doesn't render reliably in expo-image
      // (esp. on web) — the avatar <Image>s that DO show all use { uri }. This is why every
      // property photo (cards + detail slider, all via SmartImage) showed only the blurhash.
      source={uri ? { uri } : undefined}
      placeholder={local ? { uri: local } : BLUR_PLACEHOLDER}
      placeholderContentFit={contentFit}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
    />
  );
}
