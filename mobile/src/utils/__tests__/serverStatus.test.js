jest.mock("expo-constants", () => ({ expoConfig: { extra: {} } }));
import { trackedFetch, onServerSlow } from "../serverStatus";

describe("trackedFetch (cold-start handling)", () => {
  beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn(); });
  afterEach(() => { jest.useRealTimers(); });

  test("GET retries once after a network error and returns the second response", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("Network request failed")).mockResolvedValueOnce({ status: 200, ok: true });
    const p = trackedFetch("http://x/properties");
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toMatchObject({ status: 200 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("GET retries once on 503 while the server is starting", async () => {
    global.fetch.mockResolvedValueOnce({ status: 503, ok: false }).mockResolvedValueOnce({ status: 200, ok: true });
    const p = trackedFetch("http://x/properties");
    await jest.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toMatchObject({ status: 200 });
  });

  test("POST is never retried (no double-submit)", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(trackedFetch("http://x/messages", { method: "POST" })).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("flags slow after 4 s pending and clears when the request finishes", async () => {
    let resolve;
    global.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const seen = [];
    const off = onServerSlow((v) => seen.push(v));
    const p = trackedFetch("http://x/properties");
    await jest.advanceTimersByTimeAsync(4100);
    expect(seen[seen.length - 1]).toBe(true);
    resolve({ status: 200, ok: true });
    await p;
    expect(seen[seen.length - 1]).toBe(false);
    off();
  });
});
