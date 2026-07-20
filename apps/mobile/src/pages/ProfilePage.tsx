import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar, List, Input, Button, Toast } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { api } from "../services/api";
import { getServerUrl } from "../services/serverConfig";

function resolveFileUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `${getServerUrl()}${url}`;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateProfileInStore = useAuthStore((s) => s.updateProfile);

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);

  // 修改密码相关
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="page-container">
        <NavBar onBack={() => navigate(-1)}>{t("settings.profile")}</NavBar>
        <div style={{ padding: "40px", textAlign: "center", color: "var(--feiyu-text-muted)" }}>
          {t("contact.notFound")}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateProfileInStore(displayName);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      Toast.show({ content: e?.message || t("settings.securitySection.changeFailed"), position: "center" });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${getServerUrl()}/api/users/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      const data = await res.json();
      // 更新本地存储与 store
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        u.avatar_url = data.avatar_url;
        localStorage.setItem("user", JSON.stringify(u));
        useAuthStore.setState({ user: u });
      }
      setAvatarVersion((v) => v + 1);
      Toast.show({ content: t("settings.profileSection.saved"), position: "center" });
    } catch (err: any) {
      Toast.show({ content: err?.message || "Upload failed", position: "center" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleChangePassword = async () => {
    setPwdError(null);
    setPwdSuccess(false);
    if (newPwd.length < 6) {
      setPwdError(t("settings.securitySection.passwordMinLength"));
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(t("settings.securitySection.passwordMismatch"));
      return;
    }
    try {
      await api.changePassword(oldPwd, newPwd);
      setPwdSuccess(true);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => setPwdSuccess(false), 3000);
    } catch (e: any) {
      setPwdError(e?.message || t("settings.securitySection.changeFailed"));
    }
  };

  const avatarUrl = resolveFileUrl(user.avatar_url);
  const initial = (user.display_name || user.username || "?").charAt(0).toUpperCase();

  return (
    <div className="page-container">
      <NavBar
        onBack={() => navigate(-1)}
        style={{
          backgroundColor: "var(--feiyu-card)",
          borderBottom: "1px solid var(--feiyu-border)",
        }}
      >
        {t("settings.profile")}
      </NavBar>

      <div className="page-content" style={{ paddingBottom: "24px" }}>
        {/* 头像区域 */}
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: "var(--feiyu-card)",
            marginBottom: "12px",
          }}
        >
          <div
            onClick={handleAvatarClick}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              margin: "0 auto 12px",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              background: "var(--feiyu-primary)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 600,
            }}
          >
            {avatarUrl ? (
              <img
                key={avatarVersion}
                src={avatarUrl}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initial
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                opacity: uploading ? 1 : 0,
                transition: "opacity 0.2s",
              }}
            >
              {uploading ? "..." : t("settings.profileSection.uploadAvatar")}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--feiyu-text-muted)" }}>
            {t("settings.profileSection.uploadAvatar")}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarUpload}
          />
        </div>

        {/* 资料编辑 */}
        <List header={t("settings.profile")}>
          <List.Item>
            <div style={{ padding: "8px 0" }}>
              <div style={{ fontSize: "13px", color: "var(--feiyu-text-muted)", marginBottom: "6px" }}>
                {t("settings.profileSection.nickname")}
              </div>
              <Input
                value={displayName}
                onChange={setDisplayName}
                placeholder={t("settings.profileSection.nicknamePlaceholder")}
                clearable
                style={{
                  "--font-size": "16px",
                  padding: "8px 12px",
                  border: "1px solid var(--feiyu-border)",
                  borderRadius: "8px",
                }}
              />
            </div>
          </List.Item>
          <List.Item extra={user.username}>
            {t("settings.profileSection.username")}
          </List.Item>
          <List.Item extra={user.email}>
            {t("settings.profileSection.email")}
          </List.Item>
        </List>

        <div style={{ padding: "16px" }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleSave}
            style={{ borderRadius: "8px" }}
          >
            {saved ? t("settings.profileSection.saved") : t("settings.profileSection.save")}
          </Button>
        </div>

        {/* 修改密码 */}
        <List header={t("settings.securitySection.changePassword")}>
          <List.Item>
            <div style={{ padding: "8px 0" }}>
              <Input
                type="password"
                value={oldPwd}
                onChange={setOldPwd}
                placeholder={t("settings.securitySection.currentPassword")}
                clearable
                style={{
                  "--font-size": "16px",
                  padding: "12px",
                  border: "1px solid var(--feiyu-border)",
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              />
              <Input
                type="password"
                value={newPwd}
                onChange={setNewPwd}
                placeholder={t("settings.securitySection.newPassword")}
                clearable
                style={{
                  "--font-size": "16px",
                  padding: "12px",
                  border: "1px solid var(--feiyu-border)",
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              />
              <Input
                type="password"
                value={confirmPwd}
                onChange={setConfirmPwd}
                placeholder={t("settings.securitySection.confirmPassword")}
                clearable
                style={{
                  "--font-size": "16px",
                  padding: "12px",
                  border: "1px solid var(--feiyu-border)",
                  borderRadius: "8px",
                }}
              />
              {pwdError && (
                <div style={{ color: "var(--feiyu-danger)", fontSize: "12px", marginTop: "8px" }}>
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div style={{ color: "var(--feiyu-success)", fontSize: "12px", marginTop: "8px" }}>
                  {t("settings.securitySection.passwordUpdated")}
                </div>
              )}
              <Button
                block
                color="primary"
                size="middle"
                onClick={handleChangePassword}
                disabled={!oldPwd || !newPwd || !confirmPwd}
                style={{ borderRadius: "8px", marginTop: "12px" }}
              >
                {t("settings.securitySection.changeBtn")}
              </Button>
            </div>
          </List.Item>
        </List>
      </div>
    </div>
  );
}
