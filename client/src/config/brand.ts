import {
  APP_NAME,
  APP_SLUG,
  BRAND_COLOR,
  DEFAULT_LOCALE,
  type AppBranding,
} from "@unah-red-tutores/shared";

import logoUrl from "../assets/logo.svg";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Validate a configured brand colour. Invalid values silently fall back so a
 * bad environment variable can never break the UI.
 */
export function resolveBrandColor(
  value: string | undefined,
  fallback: string = BRAND_COLOR,
): string {
  const candidate = value?.trim() ?? "";
  return HEX_COLOR.test(candidate) ? candidate : fallback;
}

/**
 * Resolve the default locale against the locales that actually ship. An
 * unknown value falls back to English.
 */
export function resolveDefaultLocale(
  value: string | undefined,
  fallback: string = DEFAULT_LOCALE,
): SupportedLocale {
  const candidate = (value?.trim() || fallback).toLowerCase();
  return SUPPORTED_LOCALES.includes(candidate as SupportedLocale)
    ? (candidate as SupportedLocale)
    : "en";
}

const env = import.meta.env;

/** Single source of truth for branding in the client. */
export type Brand = Readonly<
  Omit<AppBranding, "defaultLocale"> & { defaultLocale: SupportedLocale }
>;

export const brand: Brand = Object.freeze({
  name: env.VITE_APP_NAME?.trim() || APP_NAME,
  slug: env.VITE_APP_SLUG?.trim() || APP_SLUG,
  logo: logoUrl,
  defaultLocale: resolveDefaultLocale(env.VITE_DEFAULT_LOCALE),
  brandColor: resolveBrandColor(env.VITE_BRAND_COLOR),
});
