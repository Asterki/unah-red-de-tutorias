import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { FaPlus } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  ID_TYPES,
  ROLES,
  createAccountSchema,
  setAccountPasswordSchema,
  updateAccountSchema,
  type AccountDto,
  type IdType,
  type Role,
} from "@unah-red-tutores/shared";

import AdminPageLayout from "../../../layouts/Admin";
import { RequirePermission, useCan } from "../../../rbac";
import { accountsApi } from "../../../features/accounts/api";
import { normalizeApiError } from "../../../utils/api";
import {
  translateApiError,
  translateValidationError,
} from "../../../i18n/errors";
import type { RootState } from "../../../store";

const { Title, Text } = Typography;

const ROLE_COLORS: Record<Role, string> = {
  tech_admin: "red",
  general_admin: "volcano",
  campus_admin: "gold",
  tutor: "blue",
  student: "cyan",
  external: "purple",
  observer: "default",
};

type CreateState = {
  open: boolean;
  loading: boolean;
  name: string;
  email: string;
  idType: IdType;
  identifier: string;
  password: string;
  role: Role;
};

type EditState = {
  open: boolean;
  loading: boolean;
  id: string;
  name: string;
  email: string;
  idType: IdType;
  identifier: string;
  role: Role;
};

type PasswordState = {
  open: boolean;
  loading: boolean;
  id: string;
  newPassword: string;
};

const emptyCreate: CreateState = {
  open: false,
  loading: false,
  name: "",
  email: "",
  idType: "account_number",
  identifier: "",
  password: "",
  role: "student",
};

const emptyEdit: EditState = {
  open: false,
  loading: false,
  id: "",
  name: "",
  email: "",
  idType: "account_number",
  identifier: "",
  role: "student",
};

const emptyPassword: PasswordState = {
  open: false,
  loading: false,
  id: "",
  newPassword: "",
};

export default function AccountsPage() {
  const { t } = useTranslation("accounts");
  const { t: tCommon } = useTranslation("common");
  const { t: tErrors } = useTranslation("errors");
  const { t: tValidation } = useTranslation("validation");
  const { t: tRoles } = useTranslation("roles");
  const { message, modal } = App.useApp();
  const { can, canManage } = useCan();
  const { account } = useSelector((state: RootState) => state.auth);

  const [rows, setRows] = useState<AccountDto[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [createState, setCreateState] = useState<CreateState>(emptyCreate);
  const [editState, setEditState] = useState<EditState>(emptyEdit);
  const [passwordState, setPasswordState] =
    useState<PasswordState>(emptyPassword);

  const reportError = useCallback(
    (error: unknown) => {
      const normalized = normalizeApiError(error);
      message.error(translateApiError(tErrors, normalized));
    },
    [message, tErrors],
  );

  const load = useCallback(
    async (page = 1, pageSize = meta.pageSize) => {
      setLoading(true);
      try {
        const response = await accountsApi.list({
          page,
          pageSize,
          search: search.trim() || undefined,
          includeDeleted,
        });
        setRows(response.data);
        setMeta(response.meta);
      } catch (error) {
        reportError(error);
      } finally {
        setLoading(false);
      }
    },
    [includeDeleted, meta.pageSize, reportError, search],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const assignableRoles = ROLES.filter((role) => canManage(role));

  const canActOn = (row: AccountDto) => Boolean(account) && canManage(row.role);

  const handleCreate = async () => {
    const parsed = createAccountSchema.safeParse(createState);
    if (!parsed.success) {
      message.warning(
        translateValidationError(tValidation, parsed.error.issues[0]?.message),
      );
      return;
    }

    setCreateState((prev) => ({ ...prev, loading: true }));
    try {
      await accountsApi.create(parsed.data);
      message.success(t("messages.createSuccess"));
      setCreateState(emptyCreate);
      await load(1);
    } catch (error) {
      reportError(error);
      setCreateState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleEdit = async () => {
    const parsed = updateAccountSchema.safeParse({
      name: editState.name,
      email: editState.email,
      idType: editState.idType,
      identifier: editState.identifier,
      role: editState.role,
    });
    if (!parsed.success) {
      message.warning(
        translateValidationError(tValidation, parsed.error.issues[0]?.message),
      );
      return;
    }

    setEditState((prev) => ({ ...prev, loading: true }));
    try {
      await accountsApi.update(editState.id, parsed.data);
      message.success(t("messages.updateSuccess"));
      setEditState(emptyEdit);
      await load(meta.page, meta.pageSize);
    } catch (error) {
      reportError(error);
      setEditState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleStatus = (row: AccountDto) => {
    const status = row.status === "active" ? "inactive" : "active";
    modal.confirm({
      title: t("modals.statusTitle"),
      content: t("modals.statusContent", {
        name: row.name,
        status: t(`status.${status}`),
      }),
      okText: tCommon("confirm"),
      cancelText: tCommon("cancel"),
      onOk: async () => {
        try {
          await accountsApi.setStatus(row.id, status);
          message.success(t("messages.statusSuccess"));
          await load(meta.page, meta.pageSize);
        } catch (error) {
          reportError(error);
        }
      },
    });
  };

  const handlePassword = async () => {
    const parsed = setAccountPasswordSchema.safeParse({
      newPassword: passwordState.newPassword,
    });
    if (!parsed.success) {
      message.warning(
        translateValidationError(tValidation, parsed.error.issues[0]?.message),
      );
      return;
    }

    setPasswordState((prev) => ({ ...prev, loading: true }));
    try {
      await accountsApi.setPassword(passwordState.id, parsed.data.newPassword);
      message.success(t("messages.passwordSuccess"));
      setPasswordState(emptyPassword);
    } catch (error) {
      reportError(error);
      setPasswordState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleDelete = (row: AccountDto) => {
    modal.confirm({
      title: t("modals.deleteTitle"),
      content: t("modals.deleteContent", { name: row.name }),
      okText: tCommon("yes"),
      cancelText: tCommon("no"),
      onOk: async () => {
        try {
          await accountsApi.remove(row.id);
          message.success(t("messages.deleteSuccess"));
          await load(meta.page, meta.pageSize);
        } catch (error) {
          reportError(error);
        }
      },
    });
  };

  const handleRestore = (row: AccountDto) => {
    modal.confirm({
      title: t("modals.restoreTitle"),
      content: t("modals.restoreContent", { name: row.name }),
      okText: tCommon("yes"),
      cancelText: tCommon("no"),
      onOk: async () => {
        try {
          await accountsApi.restore(row.id);
          message.success(t("messages.restoreSuccess"));
          await load(meta.page, meta.pageSize);
        } catch (error) {
          reportError(error);
        }
      },
    });
  };

  const columns: ColumnsType<AccountDto> = [
    {
      title: t("table.name"),
      dataIndex: "name",
      key: "name",
      render: (_value, row) => (
        <Space>
          <span>{row.name}</span>
          {row.deleted && <Tag color="red">{t("table.deleted")}</Tag>}
        </Space>
      ),
    },
    {
      title: t("table.email"),
      dataIndex: "email",
      key: "email",
    },
    {
      title: t("table.role"),
      dataIndex: "role",
      key: "role",
      render: (role: Role) => (
        <Tag color={ROLE_COLORS[role]}>{tRoles(`names.${role}`)}</Tag>
      ),
    },
    {
      title: t("table.status"),
      dataIndex: "status",
      key: "status",
      render: (status: AccountDto["status"]) => (
        <Tag color={status === "active" ? "green" : "red"}>
            {t(`status.${status}`)}
          </Tag>
      ),
    },
    {
      title: t("table.lastLogin"),
      dataIndex: "lastLogin",
      key: "lastLogin",
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : t("table.never"),
    },
    {
      title: t("table.actions"),
      key: "actions",
      render: (_value, row) => {
        const manageable = canActOn(row);
        return (
          <Space wrap>
            <Button
              size="small"
              disabled={!manageable || row.deleted || !can("accounts:update")}
              onClick={() => {
                setEditState({
                  open: true,
                  loading: false,
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  idType: row.idType,
                  identifier: row.identifier,
                  role: row.role,
                });
              }}
            >
              {t("actions.edit")}
            </Button>
            <Button
              size="small"
              disabled={
                !manageable || row.deleted || !can("accounts:update-status")
              }
              onClick={() => handleStatus(row)}
            >
              {row.status === "active"
                ? t("actions.deactivate")
                : t("actions.activate")}
            </Button>
            <Button
              size="small"
              disabled={
                !manageable || row.deleted || !can("accounts:change-password")
              }
              onClick={() =>
                setPasswordState({
                  open: true,
                  loading: false,
                  id: row.id,
                  newPassword: "",
                })
              }
            >
              {t("actions.password")}
            </Button>
            {row.deleted ? (
              <Button
                size="small"
                disabled={!manageable || !can("accounts:restore")}
                onClick={() => handleRestore(row)}
              >
                {t("actions.restore")}
              </Button>
            ) : (
              <Button
                size="small"
                danger
                disabled={!manageable || !can("accounts:delete")}
                onClick={() => handleDelete(row)}
              >
                {t("actions.delete")}
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <AdminPageLayout selectedPage="accounts">
      <RequirePermission permission="accounts:read">
        <div className="mb-2">
          {tCommon("loggedInAs", {
            name: account?.name,
            email: account?.email,
          })}
        </div>

        <Title>{t("title")}</Title>
        <Text>{t("description")}</Text>

        <div className="my-3 flex flex-wrap gap-2 items-center">
          <Button
            type="primary"
            icon={<FaPlus />}
            disabled={!can("accounts:create")}
            onClick={() =>
              setCreateState({ ...emptyCreate, open: true })
            }
          >
            {t("createAccount")}
          </Button>

          <Input.Search
            allowClear
            className="max-w-[360px]"
            placeholder={t("searchPlaceholder")}
            loading={loading}
            onSearch={(value) => setSearch(value)}
            onClear={() => setSearch("")}
          />

          <Space>
            <Switch
              checked={includeDeleted}
              onChange={(value) => setIncludeDeleted(value)}
              id="show-deleted"
            />
            <label htmlFor="show-deleted">{t("showDeleted")}</label>
          </Space>
        </div>

        <Table<AccountDto>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={{
            current: meta.page,
            pageSize: meta.pageSize,
            total: meta.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              void load(page, pageSize);
            },
          }}
        />

        <Modal
          title={t("modals.createTitle")}
          open={createState.open}
          onCancel={() => setCreateState(emptyCreate)}
          onOk={handleCreate}
          confirmLoading={createState.loading}
          okText={tCommon("create")}
          cancelText={tCommon("cancel")}
        >
          <div className="flex flex-col gap-3">
            <Input
              placeholder={t("fields.name")}
              value={createState.name}
              onChange={(event) =>
                setCreateState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
            <Input
              placeholder={t("fields.email")}
              value={createState.email}
              onChange={(event) =>
                setCreateState((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
            />
            <Select<IdType>
              value={createState.idType}
              options={ID_TYPES.map((idType) => ({
                value: idType,
                label: t(`idTypes.${idType}`),
              }))}
              onChange={(idType) =>
                setCreateState((prev) => ({ ...prev, idType }))
              }
            />
            <Input
              placeholder={t("fields.identifier")}
              value={createState.identifier}
              onChange={(event) =>
                setCreateState((prev) => ({
                  ...prev,
                  identifier: event.target.value,
                }))
              }
            />
            <Input.Password
              placeholder={t("fields.password")}
              value={createState.password}
              onChange={(event) =>
                setCreateState((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
            />
            <Select<Role>
              value={createState.role}
              options={assignableRoles.map((role) => ({
                value: role,
                label: tRoles(`names.${role}`),
              }))}
              onChange={(role) => setCreateState((prev) => ({ ...prev, role }))}
            />
          </div>
        </Modal>

        <Modal
          title={t("modals.editTitle")}
          open={editState.open}
          onCancel={() => setEditState(emptyEdit)}
          onOk={handleEdit}
          confirmLoading={editState.loading}
          okText={tCommon("save")}
          cancelText={tCommon("cancel")}
        >
          <div className="flex flex-col gap-3">
            <Input
              placeholder={t("fields.name")}
              value={editState.name}
              onChange={(event) =>
                setEditState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
            <Input
              placeholder={t("fields.email")}
              value={editState.email}
              onChange={(event) =>
                setEditState((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
            />
            <Select<IdType>
              value={editState.idType}
              options={ID_TYPES.map((idType) => ({
                value: idType,
                label: t(`idTypes.${idType}`),
              }))}
              onChange={(idType) =>
                setEditState((prev) => ({ ...prev, idType }))
              }
            />
            <Input
              placeholder={t("fields.identifier")}
              value={editState.identifier}
              onChange={(event) =>
                setEditState((prev) => ({
                  ...prev,
                  identifier: event.target.value,
                }))
              }
            />
            <Select<Role>
              value={editState.role}
              options={assignableRoles.map((role) => ({
                value: role,
                label: tRoles(`names.${role}`),
              }))}
              onChange={(role) => setEditState((prev) => ({ ...prev, role }))}
            />
          </div>
        </Modal>

        <Modal
          title={t("modals.passwordTitle")}
          open={passwordState.open}
          onCancel={() => setPasswordState(emptyPassword)}
          onOk={handlePassword}
          confirmLoading={passwordState.loading}
          okText={tCommon("save")}
          cancelText={tCommon("cancel")}
        >
          <Input.Password
            placeholder={t("fields.newPassword")}
            value={passwordState.newPassword}
            onChange={(event) =>
              setPasswordState((prev) => ({
                ...prev,
                newPassword: event.target.value,
              }))
            }
          />
        </Modal>
      </RequirePermission>
    </AdminPageLayout>
  );
}
