// Maps a just-uploaded remote URL back to the local file:// the user picked,
// so cards/detail can render the photo instantly (optimistic) instead of
// re-downloading it from the server right after publishing.

const remoteToLocal = new Map();

export function rememberLocal(remoteUrl, localUri) {
  if (remoteUrl && localUri) remoteToLocal.set(remoteUrl, localUri);
}

export function getLocalForRemote(remoteUrl) {
  return remoteToLocal.get(remoteUrl);
}
