import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import type { SessionAccountDto } from "@unah-red-tutores/shared";

import authSlice, { setAccount } from "../features/auth/slice";
import { Can } from "./Can";

function storeFor(account: SessionAccountDto) {
  const store = configureStore({ reducer: { auth: authSlice.reducer } });
  store.dispatch(setAccount(account));
  return store;
}

const viewer: SessionAccountDto = {
  id: "1",
  email: "viewer@example.test",
  name: "Viewer",
  role: "viewer",
  permissions: ["items:read"],
  status: "active",
  mustChangePassword: false,
  lastLogin: null,
};

const admin: SessionAccountDto = {
  ...viewer,
  id: "2",
  email: "admin@example.test",
  role: "admin",
  permissions: ["accounts:create"],
};

describe("Can", () => {
  it("shows children when the role has the permission", () => {
    render(
      <Provider store={storeFor(admin)}>
        <Can permission="accounts:create">
          <span>allowed</span>
        </Can>
      </Provider>,
    );

    expect(screen.getByText("allowed")).toBeInTheDocument();
  });

  it("hides children when the role lacks the permission", () => {
    render(
      <Provider store={storeFor(viewer)}>
        <Can permission="accounts:create">
          <span>forbidden</span>
        </Can>
      </Provider>,
    );

    expect(screen.queryByText("forbidden")).not.toBeInTheDocument();
  });
});
