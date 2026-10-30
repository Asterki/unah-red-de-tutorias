import { Layout, Space } from "antd";
import { useTranslation } from "react-i18next";
import { brand } from "../config/brand";

import { LanguageSwitcher } from "../components/LanguageSwitcher";

interface LayoutProps {
  children: React.ReactNode;
}

export default function GeneralLayout({ children }: LayoutProps) {
  const { t } = useTranslation("common");
  const { Header, Content, Footer } = Layout;

  return (
    <Layout className="min-h-screen">
      {/* Top Navbar */}
      <Header className="flex items-center justify-between">
        <Space align="center" className="" size={14}>
          <img
            src={brand.logo}
            alt={brand.name}
            className="h-[42px] w-[42px] object-contain"
          />
          <h1 className="!m-0 text-white font-bold text-lg">{brand.name}</h1>
        </Space>
        <LanguageSwitcher />
      </Header>

      <Content className="p-5 flex justify-center items-center">
        {children}
      </Content>

      <Footer className="text-center border-t border-gray-200 dark:border-gray-700 bg-transparent">
        {t("footer.madeBy")}{" "}
        <a href="https://github.com/Asterki/template-crud-mariadb-rbac" target="_blank" className="underline">
          {t("footer.author")}
        </a>{" "}
        | {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
