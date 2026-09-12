import { priceToRupees, areaToSqft, pricePerSqft, estimateEMI, thumbFor } from "../property";

describe("priceToRupees", () => {
  test("parses Cr / L / K with a ₹ prefix (regression: parseFloat NaN'd on ₹)", () => {
    expect(priceToRupees("₹2.4 Cr")).toBe(2.4e7);
    expect(priceToRupees("₹85 L")).toBe(85e5);
    expect(priceToRupees("₹22K/mo")).toBe(22e3);   // unspaced unit
  });
  test("parses without a currency prefix too", () => {
    expect(priceToRupees("12 L")).toBe(12e5);
    expect(priceToRupees("25 K")).toBe(25e3);       // spaced unit
  });
  test("thousands commas don't truncate the amount", () => {
    expect(priceToRupees("₹1,80,000")).toBe(180000);
  });
  test("bare number falls through as rupees", () => {
    expect(priceToRupees("5000")).toBe(5000);
  });
  test("null/garbage → null", () => {
    expect(priceToRupees("")).toBeNull();
    expect(priceToRupees(null)).toBeNull();
    expect(priceToRupees("price on request")).toBeNull();
  });
});

describe("areaToSqft", () => {
  test("acre and sq m convert", () => {
    expect(areaToSqft("5 Acres")).toBeCloseTo(5 * 43560, 0);
    expect(areaToSqft("100 sq m")).toBeCloseTo(100 * 10.764, 1);
  });
  test("thousands commas don't truncate (regression: '3,200' parsed as 3)", () => {
    expect(areaToSqft("3,200 sq ft")).toBe(3200);
  });
  test("plain sqft assumed when no unit", () => {
    expect(areaToSqft("3200 sq ft")).toBe(3200);
    expect(areaToSqft("520")).toBe(520);
  });
  test("non-positive / garbage → null", () => {
    expect(areaToSqft("0 sqft")).toBeNull();
    expect(areaToSqft("")).toBeNull();
    expect(areaToSqft("large plot")).toBeNull();
  });
});

describe("pricePerSqft", () => {
  test("formats ₹k/sqft for large values (₹2.4Cr / 3,200 sqft ≈ ₹7.5k)", () => {
    expect(pricePerSqft("₹2.4 Cr", "3,200 sq ft")).toBe("₹7.5k/sqft");
  });
  test("formats ₹/sqft for small values", () => {
    // ₹22k/mo over 520 sqft ≈ ₹42/sqft
    expect(pricePerSqft("₹22K/mo", "520 sq ft")).toBe("₹42/sqft");
  });
  test("null when either input is unparseable", () => {
    expect(pricePerSqft("price on request", "3200 sqft")).toBeNull();
    expect(pricePerSqft("₹2.4 Cr", "")).toBeNull();
  });
});

describe("estimateEMI", () => {
  test("only computes for For Sale listings", () => {
    expect(estimateEMI("₹85 L", "For Rent")).toBeNull();
    expect(estimateEMI("₹85 L", "For Sale")).toMatch(/^EMI ~₹/);
  });
  test("₹85L @ 9%/20yr ≈ ₹76.5k/mo", () => {
    // Standard amortization: P·r(1+r)^n / ((1+r)^n − 1)
    expect(estimateEMI("₹85 L", "For Sale")).toBe("EMI ~₹76k/mo");
  });
  test("null when price unparseable", () => {
    expect(estimateEMI("call for price", "For Sale")).toBeNull();
  });
});

describe("thumbFor", () => {
  test("prod absolute URL → _thumb (regression: used to only match /media/)", () => {
    expect(thumbFor("https://minio-production-26a6.up.railway.app/zamin/properties/123-ab-0.jpg"))
      .toBe("https://minio-production-26a6.up.railway.app/zamin/properties/123-ab-0_thumb.jpg");
  });
  test("dev /media URL → _thumb", () => {
    expect(thumbFor("http://localhost/media/properties/123-ab-0.jpg"))
      .toBe("http://localhost/media/properties/123-ab-0_thumb.jpg");
  });
  test("external URL (Unsplash, query string, non-.jpg) falls back to itself", () => {
    const u = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80";
    expect(thumbFor(u)).toBe(u);
  });
  test("already-a-thumb / unrelated .jpg not under /properties → unchanged", () => {
    expect(thumbFor("https://cdn.example.com/logo.jpg")).toBe("https://cdn.example.com/logo.jpg");
  });
});
