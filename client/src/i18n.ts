import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { brand, type SupportedLocale } from "./config/brand";
import enCommon from "./locales/en/common";
import enAuth from "./locales/en/auth";
import enAccounts from "./locales/en/accounts";
import enRoles from "./locales/en/roles";
import enDocs from "./locales/en/docs";
import enValidation from "./locales/en/validation";
import enErrors from "./locales/en/errors";
import esCommon from "./locales/es/common";
import esAuth from "./locales/es/auth";
import esAccounts from "./locales/es/accounts";
import esRoles from "./locales/es/roles";
import esDocs from "./locales/es/docs";
import esValidation from "./locales/es/validation";
import esErrors from "./locales/es/errors";

export const LANGUAGE_STORAGE_KEY = "language";

export const NAMESPACES = [
  "common",
  "auth",
  "accounts",
  "roles",
  "docs",
  "validation",
  "errors",
] as const;

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    accounts: enAccounts,
    roles: enRoles,
    docs: enDocs,
    validation: enValidation,
    errors: enErrors,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    accounts: esAccounts,
    roles: esRoles,
    docs: esDocs,
    validation: esValidation,
    errors: esErrors,
  },
} as const;

export function getInitialLanguage(): SupportedLocale {
  if (typeof window === "undefined") return brand.defaultLocale;

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;

  return brand.defaultLocale;
}

function applyDocumentLanguage(language: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language.split("-")[0] ?? language;
}

i18n.on("languageChanged", (language) => {
  applyDocumentLanguage(language);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
});

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  ns: NAMESPACES,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);

export default i18n;
