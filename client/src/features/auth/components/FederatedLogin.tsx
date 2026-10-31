import { Alert, Button, Card, Divider, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { FaApple, FaGoogle, FaMicrosoft } from "react-icons/fa";
import type { FederatedProvider } from "@unah-red-tutores/shared";

const { Title, Paragraph, Text } = Typography;

export const FEDERATED_ERROR_CODES = [
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

export type FederatedErrorCode = (typeof FEDERATED_ERROR_CODES)[number];

const ERROR_KEYS: Record<FederatedErrorCode, string> = {
  "domain-not-allowed": "codes.domainNotAllowed",
  "tenant-not-allowed": "codes.tenantNotAllowed",
  "use-microsoft-login": "codes.useMicrosoftLogin",
  "account-locked": "codes.accountLocked",
  "account-banned": "codes.accountBanned",
  "account-inactive": "codes.accountInactive",
  "email-not-verified": "codes.emailNotVerified",
  "provider-error": "codes.providerError",
  "invalid-state": "codes.invalidState",
};

export function isFederatedErrorCode(
  value: string | null | undefined,
): value is FederatedErrorCode {
  return (
    typeof value === "string" &&
    (FEDERATED_ERROR_CODES as readonly string[]).includes(value)
  );
}

type FederatedLoginProps = {
  providers: FederatedProvider[];
  errorCode?: string | null;
};

function ProviderButton({
  provider,
  label,
  icon,
}: {
  provider: FederatedProvider;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Button
      size="large"
      block
      icon={icon}
      onClick={() => {
        window.location.href = `/api/auth/${provider}`;
      }}
    >
      {label}
    </Button>
  );
}

/**
 * Pure presentation of the federated entry point. The route owns data loading
 * so tests can exercise every provider/error combination without a network.
 */
export function FederatedLogin({
  providers,
  errorCode,
}: FederatedLoginProps) {
  const { t } = useTranslation("auth", { keyPrefix: "login" });
  const { t: tErrors } = useTranslation("errors");

  const hasMicrosoft = providers.includes("microsoft");
  const hasGoogle = providers.includes("google");
  const hasApple = providers.includes("apple");
  const hasApplicantProvider = hasGoogle || hasApple;

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 text-center">
        <Title level={2} className="!mb-1">
          {t("title")}
        </Title>
        <Paragraph className="!mb-0">{t("description")}</Paragraph>
      </div>

      {isFederatedErrorCode(errorCode) && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message={t("errorTitle")}
          description={tErrors(ERROR_KEYS[errorCode])}
          role="alert"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("employeeTitle")} className="h-full shadow-md">
          <Paragraph type="secondary">{t("employeeDescription")}</Paragraph>
          {hasMicrosoft ? (
            <ProviderButton
              provider="microsoft"
              label={t("microsoft")}
              icon={<FaMicrosoft />}
            />
          ) : (
            <Text type="secondary">{t("noProviders")}</Text>
          )}
        </Card>

        <Card title={t("applicantTitle")} className="h-full shadow-md">
          <Paragraph type="secondary">{t("applicantDescription")}</Paragraph>
          {hasApplicantProvider ? (
            <Space direction="vertical" className="w-full" size="middle">
              {hasGoogle && (
                <ProviderButton
                  provider="google"
                  label={t("google")}
                  icon={<FaGoogle />}
                />
              )}
              {hasApple && (
                <ProviderButton
                  provider="apple"
                  label={t("apple")}
                  icon={<FaApple />}
                />
              )}
            </Space>
          ) : (
            <Text type="secondary">{t("noProviders")}</Text>
          )}
        </Card>
      </div>

      <Divider>{t("passwordDivider")}</Divider>

      <div className="text-center">
        <a href="/auth/password">
          <Button type="link">{t("passwordButton")}</Button>
        </a>
      </div>
    </div>
  );
}

export default FederatedLogin;
