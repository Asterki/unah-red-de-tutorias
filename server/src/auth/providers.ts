import type {
  FederatedProvider,
} from "@unah-red-tutores/shared";

import type { AppConfig } from "../config/index.js";

export type FederatedProviderConfig = Pick<
  AppConfig,
  | "port"
  | "authCallbackBaseUrl"
  | "microsoftClientId"
  | "microsoftClientSecret"
  | "microsoftAllowedTenantIds"
  | "googleClientId"
  | "googleClientSecret"
  | "appleClientId"
  | "appleTeamId"
  | "appleKeyId"
  | "applePrivateKey"
  | "applePrivateKeyPath"
>;

export type ProviderState = {
  enabled: FederatedProvider[];
  isEnabled: (provider: FederatedProvider) => boolean;
  callbackUrl: (provider: FederatedProvider) => string;
};

function appleConfigured(config: FederatedProviderConfig): boolean {
  return Boolean(
    config.appleClientId &&
      config.appleTeamId &&
      config.appleKeyId &&
      (config.applePrivateKey || config.applePrivateKeyPath),
  );
}

/**
 * A provider is available only when every variable it needs is configured.
 * Missing configuration keeps the app bootable and its routes return 404.
 */
export function resolveProviders(
  config: FederatedProviderConfig,
): ProviderState {
  const enabled: FederatedProvider[] = [];

  if (
    config.microsoftClientId &&
    config.microsoftClientSecret &&
    config.microsoftAllowedTenantIds.length > 0
  ) {
    enabled.push("microsoft");
  }
  if (config.googleClientId && config.googleClientSecret) {
    enabled.push("google");
  }
  if (appleConfigured(config)) {
    enabled.push("apple");
  }

  const enabledSet = new Set(enabled);
  const baseUrl = (
    config.authCallbackBaseUrl ?? `http://localhost:${config.port}`
  ).replace(/\/+$/, "");

  return {
    enabled: Object.freeze([...enabled]) as FederatedProvider[],
    isEnabled: (provider) => enabledSet.has(provider),
    callbackUrl: (provider) => `${baseUrl}/api/auth/${provider}/callback`,
  };
}
