import { authApi as authContracts } from "@unah-red-tutores/shared";

import { api, resetCsrfToken } from "../../utils/api";

export const authApi = {
  async login(body: authContracts.LoginRequest) {
    return api.post<authContracts.LoginResponse>("/auth/login", body);
  },

  async me() {
    return api.get<authContracts.MeResponse>("/auth/me");
  },

  async logout() {
    const response = await api.post<authContracts.LogoutResponse>(
      "/auth/logout",
      {},
    );
    resetCsrfToken();
    return response;
  },

  async changePassword(body: authContracts.ChangePasswordRequest) {
    return api.post<authContracts.MeResponse>("/auth/change-password", body);
  },
};

export default authApi;
