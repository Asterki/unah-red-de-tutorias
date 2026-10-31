import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import {
  Drawer,
  Layout,
  Menu,
  type MenuProps,
  Space,
  Spin,
  Typography,
} from "antd";
const { Title } = Typography;

import {
  FaBars,
  FaBook,
  FaCompressArrowsAlt,
  FaKey,
  FaRegArrowAltCircleLeft,
  FaUserShield,
  FaUsers,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { brand } from "../config/brand";

import AuthFeature from "../features/auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeModeToggle } from "../components/ThemeModeToggle";
import { useCan } from "../rbac";
import { docsNavVisible } from "../features/docs/nav";
import { useThemeMode } from "../theme";
import { authRedirect } from "../rbac/guards";
import type { RootState } from "../store";

const { Header, Sider } = Layout;

interface LayoutProps {
  children: React.ReactNode;
  selectedPage?: string;
  defaultCollapsed?: boolean;
  removePadding?: boolean;
}

export default function PageLayout({
  children,
  selectedPage,
  removePadding,
  defaultCollapsed,
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation("common");
  const { can } = useCan();
  const { isDark } = useThemeMode();

  const { account } = useSelector((state: RootState) => state.auth);

  const [collapsed, setCollapsed] = useState(defaultCollapsed || false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    if (account) return;
    void dispatch(AuthFeature.actions.fetchMe())
      .unwrap()
      .catch(() => {
        navigate({ to: "/auth/login" });
      });
  }, [account, dispatch, navigate]);

  useEffect(() => {
    if (!account) return;
    const target = authRedirect(account, location.pathname);
    if (target && target !== location.pathname) {
      navigate({ to: target });
    }
  }, [account, location.pathname, navigate]);

  type MenuItem = Required<MenuProps>["items"][number];
  const menuItems = useMemo<MenuItem[]>(() => {
    if (!account) return [];

    const items: MenuItem[] = [
      {
        key: "dashboard",
        label: <Link to="/admin">{t("nav.dashboard")}</Link>,
        icon: <FaCompressArrowsAlt />,
      },
    ];

    if (can("accounts:read")) {
      items.push({
        key: "accounts",
        label: <Link to="/admin/accounts">{t("nav.accounts")}</Link>,
        icon: <FaUsers />,
      });
    }

    if (can("roles:read")) {
      items.push({
        key: "roles",
        label: <Link to="/admin/roles">{t("nav.roles")}</Link>,
        icon: <FaUserShield />,
      });
    }

    if (docsNavVisible(account.role)) {
      items.push({
        key: "docs",
        label: <Link to="/admin/docs">{t("nav.docs")}</Link>,
        icon: <FaBook />,
      });
    }

    items.push(
      {
        key: "change-password",
        label: (
          <Link to="/admin/change-password">{t("nav.changePassword")}</Link>
        ),
        icon: <FaKey />,
      },
      {
        key: "logout",
        label: (
          <Link to="/auth/logout" className="text-red-500">
            {t("nav.logout")}
          </Link>
        ),
        danger: true,
        icon: <FaRegArrowAltCircleLeft className="text-red-300" />,
      },
    );

    return items;
  }, [account, can, t]);

  return (
    <>
      <Header className="flex items-center justify-between">
        <div className="md:hidden block">
          <button
            type="button"
            onClick={() => setDrawerVisible(true)}
            className="md:hidden text-xl block text-white"
            aria-label={t("menu")}
          >
            <FaBars />
          </button>
        </div>
        <Space align="center" size={14}>
          <img
            src={brand.logo}
            alt={brand.name}
            className="h-[42px] w-[42px] object-contain"
          />
          <Title level={1} className="!m-0 !text-white text-lg">
            {brand.name}
          </Title>
        </Space>
        <Space align="center" size={12}>
          <LanguageSwitcher />
          <ThemeModeToggle />
        </Space>
      </Header>

      <Layout hasSider>
        <Sider
          breakpoint="md"
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          className="hidden md:block"
          theme={isDark ? "dark" : "light"}
          width={220}
        >
          <Menu
            mode="inline"
            defaultOpenKeys={["management"]}
            defaultSelectedKeys={[selectedPage || "dashboard"]}
            items={menuItems}
            className="h-full"
          />
        </Sider>

        <Drawer
          title={t("menu")}
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
        >
          <Menu
            mode="inline"
            defaultSelectedKeys={[selectedPage || "dashboard"]}
            items={menuItems}
            onClick={() => setDrawerVisible(false)}
          />
        </Drawer>

        <Layout className="min-h-screen bg-transparent">
          <div
            className={`${removePadding ? "" : "p-4"} dark:text-white min-h-[calc(100vh-64px)] z-10`}
          >
            {account ? (
              children
            ) : (
              <div className="text-center text-lg text-gray-500">
                <Spin size="large" />
              </div>
            )}
          </div>
        </Layout>
      </Layout>
    </>
  );
}

type AppDispatch = typeof import("../store").store.dispatch;
