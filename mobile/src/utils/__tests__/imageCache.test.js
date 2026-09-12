import { rememberLocal, getLocalForRemote } from "../imageCache";

describe("imageCache", () => {
  test("maps a remote URL back to the local file it was uploaded from", () => {
    const remote = "https://cdn.example.com/properties/abc-0.jpg";
    const local = "file:///tmp/pick-1.jpg";
    rememberLocal(remote, local);
    expect(getLocalForRemote(remote)).toBe(local);
  });

  test("unknown remote → undefined", () => {
    expect(getLocalForRemote("https://cdn.example.com/never-seen.jpg")).toBeUndefined();
  });

  test("ignores empty/missing args (no crash, nothing stored)", () => {
    expect(() => rememberLocal("", "file://x")).not.toThrow();
    expect(() => rememberLocal("https://x/y.jpg", "")).not.toThrow();
    expect(getLocalForRemote("")).toBeUndefined();
  });
});
