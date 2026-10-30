import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { App as AntApp } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemDto, Role, SessionAccountDto } from "@unah-red-tutores/shared";

import "../../i18n";
import authSlice, { setAccount } from "../auth/slice";
import { ApiRequestError } from "../../utils/api";
import { ItemsPage } from "./components/ItemsPage";
import { itemsApi } from "./api";

vi.mock("./api", () => ({
  itemsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
  },
}));

const listMock = vi.mocked(itemsApi.list);

const item: ItemDto = {
  id: "item-1",
  name: "Example item",
  description: "Example description",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  deleted: false,
};

function accountFor(role: Role): SessionAccountDto {
  return {
    id: `account-${role}`,
    email: `${role}@example.test`,
    name: role,
    role,
    permissions: [],
    status: "active",
    mustChangePassword: false,
    lastLogin: null,
  };
}

function storeFor(role: Role) {
  const store = configureStore({ reducer: { auth: authSlice.reducer } });
  store.dispatch(setAccount(accountFor(role)));
  return store;
}

function renderPage(role: Role) {
  return render(
    <AntApp>
      <Provider store={storeFor(role)}>
        <ItemsPage />
      </Provider>
    </AntApp>,
  );
}

function mockList(data: ItemDto[] = [item]) {
  listMock.mockResolvedValue({
    data,
    meta: { page: 1, pageSize: 20, total: data.length },
  });
}

describe("ItemsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rows returned by the API", async () => {
    mockList();
    renderPage("viewer");

    expect(await screen.findByText("Example item")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it("hides the create button from viewers", async () => {
    mockList();
    renderPage("viewer");

    await screen.findByText("Example item");
    expect(screen.queryByRole("button", { name: /create item/i })).toBeNull();
  });

  it("shows create but not delete to staff", async () => {
    mockList();
    renderPage("staff");

    await screen.findByText("Example item");
    expect(
      screen.getByRole("button", { name: /create item/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("renders a localised error state", async () => {
    listMock.mockRejectedValue(
      new ApiRequestError({ code: "network-error", message: "network-error" }),
    );
    renderPage("viewer");

    expect(
      await screen.findByText(/Could not connect to the server/),
    ).toBeInTheDocument();
  });
});
