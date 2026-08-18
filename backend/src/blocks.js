// True if either user has blocked the other — used to gate messaging.
async function areBlocked(pool, a, b) {
  const { rows } = await pool.query(
    `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
    [a, b]
  );
  return rows.length > 0;
}

module.exports = { areBlocked };
