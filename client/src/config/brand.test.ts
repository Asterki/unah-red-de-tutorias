import { describe, expect, it } from "vitest";
import { BRAND_COLOR } from "@unah-red-tutores/shared";

import {
  brand,
  resolveBrandColor,
  resolveDefaultLocale,
} from "./brand";

describe("brand configuration", () => {
  it("accepts 3 and 6 digit hex colours", () => {
    expect(resolveBrandColor("#abc")).toBe("#abc");
    expect(resolveBrandColor("#1E3976")).toBe("#1E3976");
  });

  it("falls back to the shared default for an invalid colour", () => {
    expect(resolveBrandColor("not-a-colour")).toBe(BRAND_COLOR);
    expect(resolveBrandColor("")).toBe(BRAND_COLOR);
    expect(resolveBrandColor(undefined)).toBe(BRAND_COLOR);
  });

  it("resolves supported locales and falls back to English", () => {
    expect(resolveDefaultLocale("es")).toBe("es");
    expect(resolveDefaultLocale("es-MX")).toBe("en");
    expect(resolveDefaultLocale("de")).toBe("en");
    expect(resolveDefaultLocale(undefined)).toBe("en");
  });

  it("exposes a frozen brand object", () => {
    expect(Object.isFrozen(brand)).toBe(true);
    expect(brand.name.length).toBeGreaterThan(0);
    expect(brand.slug.length).toBeGreaterThan(0);
  });
});
