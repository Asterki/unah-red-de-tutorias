import { itemApi } from "@unah-red-tutores/shared";

import { api } from "../../utils/api";

export const itemsApi = {
  async list(query: itemApi.ListItemsQuery) {
    return api.get<itemApi.ItemListResponse>("/items", { params: query });
  },

  async get(id: string) {
    return api.get<itemApi.ItemResponse>(`/items/${id}`);
  },

  async create(body: itemApi.CreateItemRequest) {
    return api.post<itemApi.ItemResponse>("/items", body);
  },

  async update(id: string, body: itemApi.UpdateItemRequest) {
    return api.patch<itemApi.ItemResponse>(`/items/${id}`, body);
  },

  async remove(id: string) {
    return api.delete<itemApi.ItemResponse>(`/items/${id}`);
  },

  async restore(id: string) {
    return api.post<itemApi.ItemResponse>(`/items/${id}/restore`);
  },
};

export default itemsApi;
