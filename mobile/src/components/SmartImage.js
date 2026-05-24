import React from "react";
import { Image } from "expo-image";
import { getLocalForRemote } from "../utils/imageCache";

// Neutral warm blurhash shown while a remote image streams in.
const BLUR_PLACEHOLDER = "L6Pj0^jE.AyE_3t7t7R**0o#DgR4";

// expo-image wrapper: the remote URL is always the source (canonical, cached),
// while a just-uploaded local file shows instantly as the placeholder. This keeps
// the optimistic "instant" feel without ever blanking if the local file is stale.
export default function SmartImage({ uri, style, contentFit = "cover", transition = 220 }) {
  const local = uri ? getLocalForRemote(uri) : null;
  return (
    <Image
      source={uri}
      placeholder={local || BLUR_PLACEHOLDER}
      placeholderContentFit={contentFit}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
    />
  );
}
