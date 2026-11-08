// Dynamic Expo config layered on top of app.json (Expo passes app.json in as `config`).
// Injects secrets that must not be committed — currently the Android Google Maps key.
//
// GOOGLE_MAPS_ANDROID_KEY is read from (first match wins):
//   1. the process environment (CI / EAS secrets / `docker compose` env)
//   2. mobile/.env
//   3. the repo-root .env
// The key is baked into the native AndroidManifest, so after changing it run
// `npx expo prebuild -p android` and rebuild the dev build.
const fs = require("fs");
const path = require("path");

function readEnvFile(file, name) {
  try {
    const line = fs.readFileSync(file, "utf8").split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${name}=`));
    if (!line) return undefined;
    const v = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    return v || undefined;
  } catch {
    return undefined;
  }
}

function envVar(name) {
  return process.env[name]
    || readEnvFile(path.join(__dirname, ".env"), name)
    || readEnvFile(path.join(__dirname, "..", ".env"), name);
}

module.exports = ({ config }) => {
  const mapsKey = envVar("GOOGLE_MAPS_ANDROID_KEY");
  if (!mapsKey) {
    // Keep the placeholder (blank map tiles) rather than no key (react-native-maps crashes
    // on Android without one). Warn so a missing key is obvious at build time.
    console.warn("[app.config] GOOGLE_MAPS_ANDROID_KEY not set — Android maps will show blank tiles.");
  }
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: { apiKey: mapsKey || "YOUR_ANDROID_GOOGLE_MAPS_KEY" },
      },
    },
  };
};
