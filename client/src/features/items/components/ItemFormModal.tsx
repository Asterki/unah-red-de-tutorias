import { useEffect } from "react";
import { Form, Input, Modal, Select } from "antd";
import { useTranslation } from "react-i18next";
import {
  createItemSchema,
  updateItemSchema,
  type ItemDto,
  type ItemStatus,
  type UpdateItemRequest,
} from "@unah-red-tutores/shared";

import { translateValidationError } from "../../../i18n/errors";

export type ItemFormMode = "create" | "edit";

export type ItemFormValues = Pick<
  UpdateItemRequest,
  "name" | "description" | "status"
>;

type ItemFormModalProps = {
  open: boolean;
  mode: ItemFormMode;
  item?: ItemDto | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: ItemFormValues) => void;
};

export function ItemFormModal({
  open,
  mode,
  item,
  loading,
  onCancel,
  onSubmit,
}: ItemFormModalProps) {
  const { t } = useTranslation("items");
  const { t: tCommon } = useTranslation("common");
  const { t: tValidation } = useTranslation("validation");
  const [form] = Form.useForm<ItemFormValues>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      name: item?.name ?? "",
      description: item?.description ?? "",
      status: item?.status ?? "active",
    });
  }, [form, item, open]);

  const submit = async () => {
    const values = await form.validateFields();
    const schema = mode === "create" ? createItemSchema : updateItemSchema;
    const parsed = schema.safeParse(values);

    if (!parsed.success) {
      form.setFields(
        parsed.error.issues.map((issue) => ({
          name: issue.path[0] as keyof ItemFormValues,
          errors: [
            translateValidationError(tValidation, issue.message),
          ],
        })),
      );
      return;
    }

    onSubmit(parsed.data as ItemFormValues);
  };

  return (
    <Modal
      open={open}
      title={
        mode === "create" ? t("modals.createTitle") : t("modals.editTitle")
      }
      okText={tCommon("save")}
      cancelText={tCommon("cancel")}
      confirmLoading={loading}
      onOk={submit}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form<ItemFormValues> form={form} layout="vertical">
        <Form.Item name="name" label={t("fields.name")}>
          <Input maxLength={120} />
        </Form.Item>

        <Form.Item name="description" label={t("fields.description")}>
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>

        {mode === "edit" && (
          <Form.Item name="status" label={t("fields.status")}>
            <Select<ItemStatus>
              options={[
                { value: "active", label: t("status.active") },
                { value: "archived", label: t("status.archived") },
              ]}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
