import { render, screen } from "@testing-library/react";
import { App as AntApp } from "antd";
import { beforeEach, describe, expect, it } from "vitest";

import "../../../i18n";
import i18n from "../../../i18n";
import { FederatedLogin } from "./FederatedLogin";

function renderLogin(
  providers: Array<"microsoft" | "google" | "apple">,
  errorCode?: string,
) {
  return render(
    <AntApp>
      <FederatedLogin providers={providers} errorCode={errorCode} />
    </AntApp>,
  );
}

describe("FederatedLogin", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the two clearly separated sections", () => {
    renderLogin(["microsoft", "google", "apple"]);

    expect(screen.getByText("Employee or Student")).toBeInTheDocument();
    expect(screen.getByText("I'm an Applicant")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue with Microsoft/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue with Google/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue with Apple/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Use email and password/ }),
    ).toBeInTheDocument();
  });

  it("shows only the providers returned by the API", () => {
    renderLogin(["google"]);

    expect(
      screen.getByRole("button", { name: /Continue with Google/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue with Microsoft/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue with Apple/ }),
    ).not.toBeInTheDocument();
  });

  it("renders no provider buttons when none are configured", () => {
    renderLogin([]);

    expect(screen.queryByRole("button", { name: /Continue with/ })).toBeNull();
    expect(screen.getAllByText(/No federated sign-in method/).length).toBe(2);
    expect(
      screen.getByRole("link", { name: /Use email and password/ }),
    ).toBeInTheDocument();
  });

  it("shows a localized alert for every known error code", () => {
    const codes = [
      "domain-not-allowed",
      "tenant-not-allowed",
      "use-microsoft-login",
      "account-locked",
      "account-banned",
      "account-inactive",
      "email-not-verified",
      "provider-error",
      "invalid-state",
    ] as const;

    for (const code of codes) {
      const { unmount } = renderLogin(["microsoft"], code);
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not sign|institutional|organization|locked|banned|inactive|verified|identity provider|expired/i,
      );
      unmount();
    }
  });

  it("ignores unknown error codes", () => {
    renderLogin(["microsoft"], "something-else");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses the exact Spanish section titles", async () => {
    await i18n.changeLanguage("es");
    renderLogin(["microsoft", "google", "apple"]);

    expect(screen.getByText("Empleado o Estudiante")).toBeInTheDocument();
    expect(screen.getByText("Soy Aspirante")).toBeInTheDocument();
  });
});
