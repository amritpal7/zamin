// Unit tests for on-site photo verification (server-authoritative trust).
const { computePhotoTrust, ON_SITE_THRESHOLD_M } = require("../src/photoTrust");

const PIN = { lat: 19.076, lng: 72.8777 };
// ~50m north of the pin (well within threshold)
const NEAR = { lat: 19.0765, lng: 72.8777 };
// ~2km away (well outside)
const FAR = { lat: 19.095, lng: 72.8777 };

describe("computePhotoTrust", () => {
  test("camera photo near the pin → on_site + badge", () => {
    const r = computePhotoTrust({
      incoming: [{ url: "a.jpg", source: "camera", lat: NEAR.lat, lng: NEAR.lng, at: "t" }],
      images: ["a.jpg"],
      lat: PIN.lat, lng: PIN.lng,
    });
    expect(r.on_site_verified).toBe(true);
    expect(r.photo_geo[0].on_site).toBe(true);
  });

  test("camera photo far from the pin → not on_site", () => {
    const r = computePhotoTrust({
      incoming: [{ url: "a.jpg", source: "camera", lat: FAR.lat, lng: FAR.lng }],
      images: ["a.jpg"],
      lat: PIN.lat, lng: PIN.lng,
    });
    expect(r.on_site_verified).toBe(false);
    expect(r.photo_geo[0].on_site).toBe(false);
  });

  test("gallery photo is never on_site, even at the exact pin", () => {
    const r = computePhotoTrust({
      incoming: [{ url: "a.jpg", source: "gallery", lat: PIN.lat, lng: PIN.lng }],
      images: ["a.jpg"],
      lat: PIN.lat, lng: PIN.lng,
    });
    expect(r.on_site_verified).toBe(false);
  });

  test("no pin → first on-site camera capture auto-sets the listing coords", () => {
    const r = computePhotoTrust({
      incoming: [{ url: "a.jpg", source: "camera", lat: PIN.lat, lng: PIN.lng }],
      images: ["a.jpg"],
      lat: null, lng: null,
    });
    expect(r.latitude).toBe(PIN.lat);
    expect(r.longitude).toBe(PIN.lng);
    expect(r.on_site_verified).toBe(true);
  });

  test("removed photos drop out of photo_geo", () => {
    const r = computePhotoTrust({
      existing: [{ url: "a.jpg", source: "camera", lat: NEAR.lat, lng: NEAR.lng, on_site: true }],
      incoming: [],
      images: [], // photo removed
      lat: PIN.lat, lng: PIN.lng,
    });
    expect(r.photo_geo).toHaveLength(0);
    expect(r.on_site_verified).toBe(false);
  });

  test("existing on-site geo is retained on edit when the photo stays", () => {
    const r = computePhotoTrust({
      existing: [{ url: "a.jpg", source: "camera", lat: NEAR.lat, lng: NEAR.lng, on_site: true }],
      incoming: [],
      images: ["a.jpg"],
      lat: PIN.lat, lng: PIN.lng,
    });
    expect(r.on_site_verified).toBe(true);
    expect(ON_SITE_THRESHOLD_M).toBeGreaterThan(0);
  });
});
