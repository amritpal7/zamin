const { sendPush } = require("./push");

// Insert a notification row for a user.
async function createNotification(pool, userId, { type, title, body, data }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (clerk_user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, title || null, body || null, data ? JSON.stringify(data) : null]
  );
  return rows[0];
}

// When a new listing is posted, notify everyone whose saved search matches it
// (excluding the owner). Match = type/status wildcard-or-equal, and the free-text
// search (if any) appears in the title or location.
async function notifyListingMatch(pool, property) {
  const { rows } = await pool.query(
    `SELECT DISTINCT clerk_user_id FROM saved_searches ss
       WHERE (ss.type = 'All'   OR ss.type   = $1)
         AND (ss.status = 'All' OR ss.status = $2)
         AND (COALESCE(ss.search, '') = ''
              OR $3 ILIKE '%' || ss.search || '%'
              OR $4 ILIKE '%' || ss.search || '%')
         AND ss.clerk_user_id <> $5`,
    [property.type, property.status, property.title || "", property.location || "", property.clerk_user_id]
  );
  for (const { clerk_user_id } of rows) {
    await createNotification(pool, clerk_user_id, {
      type: "listing_match",
      title: "New listing matches your search",
      body: property.title,
      data: { propertyId: property.id, kind: "listing" },
    });
    sendPush(clerk_user_id, {
      title: "New matching listing",
      body: property.title,
      data: { propertyId: property.id, kind: "listing" },
    });
  }
  return rows.length;
}

module.exports = { createNotification, notifyListingMatch };
