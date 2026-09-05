// Unit tests for price-insight parsing + verdict logic.
const { priceToRupees, areaToSqft, pricePerSqft, median, computeInsights } = require("../src/insights");

describe("price/area parsing", () => {
  test("priceToRupees handles Cr / L / K / plain + ₹ + commas", () => {
    expect(priceToRupees("₹2.4 Cr")).toBe(2.4e7);
    expect(priceToRupees("₹85 L")).toBe(85e5);
    expect(priceToRupees("₹22K")).toBe(22e3);
    expect(priceToRupees("₹28,000/mo")).toBe(28000);
    expect(priceToRupees("")).toBeNull();
  });
  test("areaToSqft handles sq ft / acres / commas", () => {
    expect(areaToSqft("3,200 sq ft")).toBe(3200);
    expect(areaToSqft("5 Acres")).toBe(5 * 43560);
    expect(areaToSqft("0")).toBeNull();
  });
  test("pricePerSqft = rupees / sqft, bounded", () => {
    expect(pricePerSqft("₹1 Cr", "1000 sq ft")).toBe(10000);
    expect(pricePerSqft("₹1 Cr", "0 sq ft")).toBeNull();
  });
  test("median", () => {
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 20])).toBe(15);
    expect(median([])).toBeNull();
  });
});

describe("computeInsights verdicts", () => {
  const L = (price, area) => ({ price, area, status: "For Sale", type: "Apartment" });
  // area median ≈ ₹10,000/sqft (three comps at 1Cr/1000sqft)
  const comps = [L("₹1 Cr", "1000 sq ft"), L("₹1 Cr", "1000 sq ft"), L("₹1 Cr", "1000 sq ft")];

  test("good deal: listing well below area median", () => {
    const r = computeInsights(L("₹80 L", "1000 sq ft"), comps, "Testville"); // ₹8000/sqft vs 10000
    expect(r.verdict).toBe("good_deal");
    expect(r.deltaPct).toBeLessThan(0);
    expect(r.areaMedianPerSqft).toBe(10000);
    expect(r.sampleSize).toBe(3);
  });
  test("above market: listing well above median", () => {
    expect(computeInsights(L("₹1.3 Cr", "1000 sq ft"), comps, "Testville").verdict).toBe("above_market");
  });
  test("at market: within ±10%", () => {
    expect(computeInsights(L("₹1.02 Cr", "1000 sq ft"), comps, "Testville").verdict).toBe("at_market");
  });
  test("insufficient when fewer than 3 comparables", () => {
    expect(computeInsights(L("₹1 Cr", "1000 sq ft"), [L("₹1 Cr", "1000 sq ft")], "Testville").verdict).toBe("insufficient");
  });
  test("insufficient when this listing has no parseable ₹/sqft", () => {
    expect(computeInsights(L("Call for price", "n/a"), comps, "Testville").verdict).toBe("insufficient");
  });
});
