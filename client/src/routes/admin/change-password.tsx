import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Alert, App, Button, Card, Input, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { changePasswordSchema } from "@unah-red-tutores/shared";

import AdminPageLayout from "../../layouts/Admin";
import AuthFeature from "../../features/auth";
import { normalizeApiError } from "../../utils/api";
import {
  translateApiError,
  translateValidationError,
} from "../../i18n/errors";
import type { AppDispatch, RootState } from "../../store";

const { Title, Text } = Typography;

export const Route = createFileRoute("/admin/change-password")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation("auth", {
    keyPrefix: "changePassword",
  });
  const { t: tCommon } = useTranslation("common");
  const { t: tValidation } = useTranslation("validation");
  const { t: tErrors } = useTranslation("errors");
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { account } = useSelector((state: RootState) => state.auth);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (newPassword !== confirmPassword) {
      message.warning(t("messages.mismatch"));
      return;
    }

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
    });
    if (!parsed.success) {
      message.warning(
        translateValidationError(tValidation, parsed.error.issues[0]?.message),
      );
      return;
    }

    setLoading(true);
    try {
      await dispatch(AuthFeature.actions.changePassword(parsed.data)).unwrap();
      message.success(t("messages.success"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate({ to: "/admin" });
    } catch (error) {
      const normalized = normalizeApiError(error);
      message.error(translateApiError(tErrors, normalized));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageLayout selectedPage="change-password">
      <Title>{t("title")}</Title>
      <Text>{t("description")}</Text>

      {account?.mustChangePassword && (
        <Alert
          className="my-4"
          type="warning"
          showIcon
          message={t("forcedTitle")}
          description={t("forcedDescription")}
        />
      )}

      <Card className="max-w-xl mt-4">
        <div className="flex flex-col gap-3">
          <Input.Password
            autoComplete="current-password"
            placeholder={t("fields.currentPassword")}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input.Password
            autoComplete="new-password"
            placeholder={t("fields.newPassword")}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Input.Password
            autoComplete="new-password"
            placeholder={t("fields.confirmPassword")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <Button type="primary" loading={loading} onClick={submit}>
            {tCommon("save")}
          </Button>
        </div>
      </Card>
    </AdminPageLayout>
  );
}
