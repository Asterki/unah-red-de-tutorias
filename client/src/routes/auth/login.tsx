import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Spin } from "antd";
import type { FederatedProvider } from "@unah-red-tutores/shared";

import GeneralLayout from "../../layouts/General";
import authApi from "../../features/auth/api";
import { FederatedLogin } from "../../features/auth/components/FederatedLogin";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

export const Route = createFileRoute("/auth/login")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { account } = useSelector((state: RootState) => state.auth);
  const [providers, setProviders] = useState<FederatedProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const errorCode = useMemo(
    () => new URLSearchParams(window.location.search).get("error"),
    [],
  );

  useEffect(() => {
    if (!account) return;
    navigate({
      to: account.mustChangePassword ? "/admin/change-password" : "/admin",
    });
  }, [account, navigate]);

  useEffect(() => {
    let cancelled = false;
    void authApi
      .providers()
      .then((response) => {
        if (!cancelled) setProviders(response.data.providers);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GeneralLayout>
      {loading ? (
        <Spin size="large" />
      ) : (
        <FederatedLogin providers={providers} errorCode={errorCode} />
      )}
    </GeneralLayout>
  );
}
