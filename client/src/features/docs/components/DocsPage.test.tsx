import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { App as AntApp } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionAccountDto } from "@unah-red-tutores/shared";

import "../../../i18n";
import authSlice, { setAccount } from "../../auth/slice";
import { useDocsManifest } from "../hooks/useDocsManifest";
import { useDoc } from "../hooks/useDoc";
import { DocsPage } from "./DocsPage";
import { docsNavVisible } from "../nav";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../hooks/useDocsManifest", () => ({
  useDocsManifest: vi.fn(),
}));

vi.mock("../hooks/useDoc", () => ({
  useDoc: vi.fn(),
}));

const manifestMock = vi.mocked(useDocsManifest);
const docMock = vi.mocked(useDoc);

function accountFor(role: SessionAccountDto["role"]): SessionAccountDto {
  return {
    id: `account-${role}`,
    email: `${role}@example.test`,
    name: role,
    role,
    permissions: role === "viewer" || role === "staff" ? [] : ["docs:read"],
    status: "active",
    mustChangePassword: false,
    lastLogin: null,
  };
}

function renderPage(role: SessionAccountDto["role"]) {
  const store = configureStore({ reducer: { auth: authSlice.reducer } });
  store.dispatch(setAccount(accountFor(role)));

  return render(
    <AntApp>
      <Provider store={store}>
        <DocsPage />
      </Provider>
    </AntApp>,
  );
}

function mockManifest() {
  manifestMock.mockReturnValue({
    data: [
      { slug: "index", title: "Operator documentation" },
      { slug: "database", title: "Switching the database" },
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
  });
  docMock.mockReturnValue({
    data: {
      slug: "index",
      title: "Operator documentation",
      markdown: "# Operators\n\nHello.",
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  });
}

describe("DocsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManifest();
  });

  it("hides the docs nav from viewers and redirects them", async () => {
    expect(docsNavVisible("viewer")).toBe(false);
    expect(docsNavVisible("staff")).toBe(false);
    renderPage("viewer");

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/admin" });
    });
    expect(screen.queryByText("Operator documentation")).not.toBeInTheDocument();
  });

  it("shows the docs nav to managers and renders the selected page", () => {
    expect(docsNavVisible("manager")).toBe(true);
    expect(docsNavVisible("admin")).toBe(true);
    renderPage("manager");

    expect(screen.getByText("Operator documentation")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switching the database/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hello.")).toBeInTheDocument();
  });
});
