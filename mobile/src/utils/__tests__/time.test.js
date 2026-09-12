import { timeAgo } from "../time";

// Build an ISO timestamp `secondsAgo` before now (mid-bucket values avoid boundary flakiness).
const ago = (secondsAgo) => new Date(Date.now() - secondsAgo * 1000).toISOString();

describe("timeAgo", () => {
  test("empty / nullish → ''", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
    expect(timeAgo("")).toBe("");
  });

  test("< 1 min → 'now'", () => {
    expect(timeAgo(ago(5))).toBe("now");
    expect(timeAgo(ago(59))).toBe("now");
  });

  test("minutes", () => {
    expect(timeAgo(ago(5 * 60 + 3))).toBe("5m ago");
    expect(timeAgo(ago(59 * 60 + 3))).toBe("59m ago");
  });

  test("hours", () => {
    expect(timeAgo(ago(3 * 3600 + 30))).toBe("3h ago");
  });

  test("days", () => {
    expect(timeAgo(ago(4 * 86400 + 60))).toBe("4d ago");
  });

  test(">= 7 days → a locale date (not a relative form)", () => {
    const out = timeAgo(ago(10 * 86400));
    expect(out).toBeTruthy();
    expect(out).not.toMatch(/ago|now/);
  });
});
