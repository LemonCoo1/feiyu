import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

const savedLang = localStorage.getItem("feiyu_language") || "zh-CN";

i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zh },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "zh-CN",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
