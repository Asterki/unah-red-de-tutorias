import type { FederatedProvider } from "../domain/federated-email.js";
import type { SessionAccountDto } from "../dto/accounts.js";
import type { DataResponse } from "../dto/pagination.js";
import type { ChangePasswordRequest, LoginRequest } from "../schemas/auth.js";

export type { ChangePasswordRequest, LoginRequest };

export type LoginResponse = DataResponse<SessionAccountDto>;
export type MeResponse = DataResponse<SessionAccountDto>;

export type CsrfResponse = {
  csrfToken: string;
};

export type LogoutResponse = {
  data: { success: true };
};

/** Providers enabled by server configuration. */
export type AuthProvidersResponse = {
  data: { providers: FederatedProvider[] };
};
