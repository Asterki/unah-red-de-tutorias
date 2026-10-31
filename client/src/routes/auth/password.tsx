import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { loginAccountSchema } from "@unah-red-tutores/shared";

import GeneralLayout from "../../layouts/General";
import AuthFeature from "../../features/auth";
import { normalizeApiError } from "../../utils/api";
import {
  translateApiError,
  translateValidationError,
} from "../../i18n/errors";
import type { AppDispatch, RootState } from "../../store";

export const Route = createFileRoute("/auth/password")({
  component: RouteComponent,
});

function RouteComponent() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { t } = useTranslation("auth", { keyPrefix: "password" });
  const { t: tValidation } = useTranslation("validation");
  const { t: tErrors } = useTranslation("errors");
  const dispatch = useDispatch<AppDispatch>();

  const { account, loading } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!account) return;
    navigate({
      to: account.mustChangePassword ? "/admin/change-password" : "/admin",
    });
  }, [account, navigate]);

  const handleLogin = async () => {
    const parsed = loginAccountSchema.safeParse({ email, password });
    if (!parsed.success) {
      message.error(translateValidationError(tValidation, parsed.error.issues[0]?.message));
      return;
    }

    try {
      const session = await dispatch(
        AuthFeature.actions.login(parsed.data),
      ).unwrap();
      message.success(t("messages.success"));
      navigate({
        to: session.mustChangePassword ? "/admin/change-password" : "/admin",
      });
    } catch (error) {
      const normalized = normalizeApiError(error);
      message.error(translateApiError(tErrors, normalized));
    }
  };

  return (
    <GeneralLayout>
      <Card
        title={
          <Typography.Title level={3} className="!mb-0 text-center">
            {t("title")}
          </Typography.Title>
        }
        className="w-full max-w-md shadow-lg"
      >
        <Typography.Paragraph className="text-center mb-6">
          {t("description")}
        </Typography.Paragraph>

        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item label={t("fields.email")} required>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              type="email"
              placeholder={t("fields.emailPlaceholder")}
            />
          </Form.Item>

          <Form.Item label={t("fields.password")} required>
            <Input.Password
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={t("fields.passwordPlaceholder")}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {t("submit")}
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-4 text-center">
          <Link to="/auth/login">{t("back")}</Link>
        </div>
      </Card>
    </GeneralLayout>
  );
}
