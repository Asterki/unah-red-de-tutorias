import { render, screen } from "@testing-library/react";
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
    permissions: ["docs:read"],
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

  it("shows the docs nav to every real role", () => {
    for (const role of [
      "tech_admin",
      "general_admin",
      "campus_admin",
      "tutor",
      "student",
      "external",
      "observer",
    ] as const) {
      expect(docsNavVisible(role)).toBe(true);
    }
    renderPage("student");

    expect(screen.getByText("Operator documentation")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switching the database/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hello.")).toBeInTheDocument();
  });

  it("renders an administrator view", () => {
    renderPage("tech_admin");

    expect(screen.getByText("Operator documentation")).toBeInTheDocument();
  });
});
