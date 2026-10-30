import { accountApi } from "@unah-red-tutores/shared";

import { api } from "../../utils/api";

export const accountsApi = {
  async list(query: accountApi.ListAccountsQuery) {
    return api.get<accountApi.AccountListResponse>("/accounts", {
      params: query,
    });
  },

  async get(id: string) {
    return api.get<accountApi.AccountResponse>(`/accounts/${id}`);
  },

  async create(body: accountApi.CreateAccountRequest) {
    return api.post<accountApi.AccountResponse>("/accounts", body);
  },

  async update(id: string, body: accountApi.UpdateAccountRequest) {
    return api.patch<accountApi.AccountResponse>(`/accounts/${id}`, body);
  },

  async setStatus(id: string, status: "active" | "inactive") {
    return api.post<accountApi.AccountResponse>(`/accounts/${id}/status`, {
      status,
    });
  },

  async setPassword(id: string, newPassword: string) {
    return api.post<accountApi.AccountResponse>(`/accounts/${id}/password`, {
      newPassword,
    });
  },

  async remove(id: string) {
    return api.delete<accountApi.AccountResponse>(`/accounts/${id}`);
  },

  async restore(id: string) {
    return api.post<accountApi.AccountResponse>(`/accounts/${id}/restore`);
  },
};

export default accountsApi;
