// Lightweight, dependency-free request validation for write endpoints.
// Each validator returns an array of human-readable error strings ([] = valid).
// Routes turn a non-empty array into a 400 response.

const TYPES = ["House", "Apartment", "Land", "Commercial"];
const STATUSES = ["For Sale", "For Rent"];
const LOCATION_VISIBILITIES = ["exact", "approximate", "hidden"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isString = (v) => typeof v === "string";
const isNonEmptyString = (v) => isString(v) && v.trim().length > 0;
const isUuid = (v) => isString(v) && UUID_RE.test(v);

// Validate a property create/update payload.
// forUpdate=true relaxes create-only required fields (owner_name is set at create time).
function validateProperty(body = {}, { forUpdate = false } = {}) {
  const b = body || {};
  const errors = [];

  const requireStr = (field, max) => {
    if (!isNonEmptyString(b[field])) errors.push(`${field} is required`);
    else if (b[field].length > max) errors.push(`${field} must be at most ${max} characters`);
  };
  const optStr = (field, max) => {
    if (b[field] == null) return;
    if (!isString(b[field])) errors.push(`${field} must be a string`);
    else if (b[field].length > max) errors.push(`${field} must be at most ${max} characters`);
  };
  const optInt = (field, min, max) => {
    if (b[field] == null || b[field] === "") return;
    const n = Number(b[field]);
    if (!Number.isInteger(n) || n < min || n > max) errors.push(`${field} must be an integer between ${min} and ${max}`);
  };
  const optNum = (field, min, max) => {
    if (b[field] == null || b[field] === "") return;
    const n = Number(b[field]);
    if (Number.isNaN(n) || n < min || n > max) errors.push(`${field} must be a number between ${min} and ${max}`);
  };
  const optStrArray = (field, maxLen) => {
    if (b[field] == null) return;
    if (!Array.isArray(b[field]) || !b[field].every(isString)) errors.push(`${field} must be an array of strings`);
    else if (b[field].length > maxLen) errors.push(`${field} must have at most ${maxLen} items`);
  };

  // Required
  requireStr("title", 255);
  requireStr("price", 100);
  requireStr("location", 255);
  if (!forUpdate) requireStr("owner_name", 255);

  // Enums
  if (!TYPES.includes(b.type)) errors.push(`type must be one of: ${TYPES.join(", ")}`);
  if (!STATUSES.includes(b.status)) errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  if (b.location_visibility != null && !LOCATION_VISIBILITIES.includes(b.location_visibility))
    errors.push(`location_visibility must be one of: ${LOCATION_VISIBILITIES.join(", ")}`);

  // Optional strings
  optStr("description", 5000);
  optStr("area", 100);
  optStr("owner_phone", 50);
  optStr("owner_avatar", 10);
  optStr("img", 10);
  optStr("color", 20);

  // Optional numerics
  optInt("beds", 0, 100);
  optInt("baths", 0, 100);
  optNum("latitude", -90, 90);
  optNum("longitude", -180, 180);

  // Parcel/plot boundary: optional polygon of {lat,lng} points (≤60), or [] to clear.
  if (b.parcel != null) {
    if (!Array.isArray(b.parcel) || b.parcel.length > 60) {
      errors.push("parcel must be an array of at most 60 points");
    } else if (!b.parcel.every((pt) => pt && Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lng)))) {
      errors.push("parcel points must be {lat, lng}");
    } else if (b.parcel.length > 0 && b.parcel.length < 3) {
      errors.push("parcel needs at least 3 points to form a boundary");
    }
  }

  // Optional string arrays
  optStrArray("tags", 30);
  optStrArray("images", 8);
  optStrArray("thumbnails", 8);

  return errors;
}

// Validate a chat message payload.
function validateMessage(body = {}) {
  const b = body || {};
  const errors = [];
  if (!isNonEmptyString(b.text)) errors.push("text is required");
  else if (b.text.length > 2000) errors.push("text must be at most 2000 characters");
  if (!isNonEmptyString(b.receiver_id)) errors.push("receiver_id is required");
  return errors;
}

module.exports = { validateProperty, validateMessage, isUuid, TYPES, STATUSES, LOCATION_VISIBILITIES };
