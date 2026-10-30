import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { FaEdit, FaPlus, FaTrash, FaUndo } from "react-icons/fa";
import type {
  ItemDto,
  ItemStatus,
  ListItemsQuery,
  PageMeta,
} from "@unah-red-tutores/shared";

import { Can } from "../../../rbac";
import { translateApiError } from "../../../i18n/errors";

const { Text, Title } = Typography;

export type ItemsTableProps = {
  data: ItemDto[];
  meta: PageMeta;
  query: ListItemsQuery;
  loading: boolean;
  error: string | null;
  saving: boolean;
  onQueryChange: (patch: Partial<ListItemsQuery>) => void;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (item: ItemDto) => void;
  onDelete: (item: ItemDto) => void;
  onRestore: (item: ItemDto) => void;
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  active: "green",
  archived: "default",
};

export function ItemsTable({
  data,
  meta,
  query,
  loading,
  error,
  saving,
  onQueryChange,
  onRetry,
  onCreate,
  onEdit,
  onDelete,
  onRestore,
}: ItemsTableProps) {
  const { t } = useTranslation("items");
  const { t: tCommon } = useTranslation("common");
  const { t: tErrors } = useTranslation("errors");
  const [search, setSearch] = useState(query.q ?? "");

  useEffect(() => {
    setSearch(query.q ?? "");
  }, [query.q]);

  const columns: ColumnsType<ItemDto> = [
    {
      title: t("table.name"),
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t("table.description"),
      dataIndex: "description",
      key: "description",
      render: (description: string | null) =>
        description ? (
          <Text type="secondary">{description}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t("table.status"),
      dataIndex: "status",
      key: "status",
      render: (status: ItemStatus) => (
        <Tag color={STATUS_COLORS[status]}>{t(`status.${status}`)}</Tag>
      ),
    },
    {
      title: t("table.createdAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: string) => new Date(createdAt).toLocaleDateString(),
    },
    {
      title: tCommon("actions"),
      key: "actions",
      render: (_value, item) => (
        <Space wrap>
          {!item.deleted && (
            <Can permission="items:update">
              <Button
                type="link"
                size="small"
                icon={<FaEdit />}
                onClick={() => onEdit(item)}
              >
                {t("actions.edit")}
              </Button>
            </Can>
          )}

          {!item.deleted && (
            <Can permission="items:delete">
              <Popconfirm
                title={t("modals.deleteTitle")}
                description={t("modals.deleteContent", { name: item.name })}
                okText={tCommon("confirm")}
                cancelText={tCommon("cancel")}
                onConfirm={() => onDelete(item)}
              >
                <Button type="link" size="small" danger icon={<FaTrash />}>
                  {t("actions.delete")}
                </Button>
              </Popconfirm>
            </Can>
          )}

          {item.deleted && (
            <Can permission="items:restore">
              <Popconfirm
                title={t("modals.restoreTitle")}
                description={t("modals.restoreContent", { name: item.name })}
                okText={tCommon("confirm")}
                cancelText={tCommon("cancel")}
                onConfirm={() => onRestore(item)}
              >
                <Button type="link" size="small" icon={<FaUndo />}>
                  {t("actions.restore")}
                </Button>
              </Popconfirm>
            </Can>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={2} className="mb-0">
            {t("title")}
          </Title>
          <Text type="secondary">{t("description")}</Text>
        </div>

        <Can permission="items:create">
          <Button type="primary" icon={<FaPlus />} onClick={onCreate}>
            {t("create")}
          </Button>
        </Can>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input.Search
          className="max-w-sm"
          allowClear
          value={search}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) =>
            onQueryChange({ q: value.trim() || undefined, page: 1 })
          }
        />
        <Select<ItemStatus | "all">
          className="w-40"
          value={query.status ?? "all"}
          onChange={(value) =>
            onQueryChange({
              status: value === "all" ? undefined : value,
              page: 1,
            })
          }
          options={[
            { value: "all", label: t("status.all") },
            { value: "active", label: t("status.active") },
            { value: "archived", label: t("status.archived") },
          ]}
        />
        <Can permission="items:restore">
          <Space>
            <Switch
              checked={query.includeDeleted === true}
              onChange={(checked) =>
                onQueryChange({ includeDeleted: checked, page: 1 })
              }
            />
            <Text>{t("showDeleted")}</Text>
          </Space>
        </Can>
      </div>

      {error && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          message={translateApiError(tErrors, { code: error })}
          action={
            <Button size="small" onClick={onRetry}>
              {tCommon("retry")}
            </Button>
          }
        />
      )}

      <Table<ItemDto>
        className="mt-4"
        rowKey="id"
        loading={loading || saving}
        dataSource={data}
        columns={columns}
        locale={{ emptyText: t("empty") }}
        pagination={{
          current: meta.page,
          pageSize: meta.pageSize,
          total: meta.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (page, pageSize) => onQueryChange({ page, pageSize }),
        }}
      />
    </>
  );
}
