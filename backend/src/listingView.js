// What a listing row looks like to a given viewer. Every route that sends listing rows to
// clients goes through publicListing(), so privacy rules live in one place:
//  - location privacy (redactLocation: exact / approximate / hidden, photo_geo stripped)
//  - contact privacy: owner_phone is never sent to non-owners. They get `has_phone` and must
//    call GET /properties/:id/contact, which only answers once they've messaged the owner
//    (stops scraping every owner's number from the public listing feed).
const { redactLocation } = require("./locationPrivacy");

const hasPhone = (row) => !!String(row?.owner_phone || "").replace(/\D/g, "").length;

function publicListing(row, viewerId) {
  if (!row) return row;
  const out = redactLocation(row, viewerId);
  out.has_phone = hasPhone(row);
  if (!(viewerId && row.clerk_user_id === viewerId)) delete out.owner_phone;
  return out;
}

module.exports = { publicListing, hasPhone };
