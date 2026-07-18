import { useNavigate } from "react-router-dom";
import { NavBar, List, CheckList } from "antd-mobile";
import type { CheckListValue } from "antd-mobile/es/components/check-list";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settingsStore";

const languages = [
  { value: "zh" as CheckListValue, label: "简体中文", labelEn: "Chinese" },
  { value: "en" as CheckListValue, label: "English", labelEn: "English" },
];

export function LanguagePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const currentLang = i18n.language.startsWith("zh") ? "zh" : "en";

  const handleChange = async (val: CheckListValue[]) => {
    const newLang = val[0] as string;
    if (newLang && newLang !== currentLang) {
      await i18n.changeLanguage(newLang);
      await updateSettings({ language: newLang });
    }
    navigate(-1);
  };

  return (
    <div className="page-container">
      <NavBar onBack={() => navigate(-1)}>
        {t("settings.language")}
      </NavBar>
      <div style={{ padding: "12px 0" }}>
        <List>
          <CheckList
            defaultValue={[currentLang]}
            onChange={handleChange}
          >
            {languages.map((lang) => (
              <CheckList.Item key={lang.value} value={lang.value}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>{lang.label}</span>
                  <span style={{ color: "var(--feiyu-text-muted)", fontSize: "13px" }}>
                    {lang.labelEn}
                  </span>
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </List>
      </div>
    </div>
  );
}
