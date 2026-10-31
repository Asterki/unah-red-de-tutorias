import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { App as AntApp } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionAccountDto } from "@unah-red-tutores/shared";

import "../i18n";
import authSlice, { setAccount } from "../features/auth/slice";
import { RequirePermission } from "./RequirePermission";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

function storeFor(account: SessionAccountDto) {
  const store = configureStore({ reducer: { auth: authSlice.reducer } });
  store.dispatch(setAccount(account));
  return store;
}

const base: SessionAccountDto = {
  id: "1",
  email: "user@example.test",
  name: "User",
  role: "observer",
  permissions: ["docs:read"],
  status: "active",
  mustChangePassword: false,
  lastLogin: null,
};

function renderGuard(account: SessionAccountDto) {
  return render(
    <AntApp>
      <Provider store={storeFor(account)}>
        <RequirePermission permission="accounts:read">
          <span>allowed</span>
        </RequirePermission>
      </Provider>
    </AntApp>,
  );
}

describe("RequirePermission", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("redirects to the dashboard when the permission is missing", async () => {
    renderGuard(base);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/admin" });
    });
    expect(screen.queryByText("allowed")).not.toBeInTheDocument();
  });

  it("renders the page when the permission is granted", () => {
    renderGuard({ ...base, role: "tech_admin", permissions: ["accounts:read"] });

    expect(screen.getByText("allowed")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
