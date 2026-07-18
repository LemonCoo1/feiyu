import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Toast } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { getServerUrl, setServerUrl, validateServerUrl, normalizeServerUrl, getDefaultServerUrl } from "../services/serverConfig";

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrlState, setServerUrlState] = useState<string>(getServerUrl());
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");
  const [showServerSettings, setShowServerSettings] = useState(false);
  const testAbortRef = useRef<AbortController | null>(null);

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
    return () => {
      testAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (user && token) {
      navigate("/conversations", { replace: true });
    }
  }, [user, token]);

  const handleServerUrlBlur = () => {
    const err = validateServerUrl(serverUrlState);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    setServerUrl(serverUrlState);
  };

  const handleTestConnection = async () => {
    const err = validateServerUrl(serverUrlState);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    if (testAbortRef.current) {
      testAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    testAbortRef.current = ctrl;
    setTestState("testing");
    try {
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${normalizeServerUrl(serverUrlState)}/api/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        setTestState("ok");
        setTestMsg("");
      } else {
        setTestState("fail");
        setTestMsg(`${res.status}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "network";
      setTestState("fail");
      setTestMsg(e instanceof DOMException && e.name === "AbortError" ? "timeout" : msg);
    }
  };

  const handleSubmit = async () => {
    const urlErr = validateServerUrl(serverUrlState);
    if (!urlErr) {
      setServerUrl(serverUrlState);
    }
    if (isLogin) {
      if (!email || !password) {
        Toast.show({ content: t("auth.fillAllFields"), position: "center" });
        return;
      }
      await login(email, password);
    } else {
      if (!username || !email || !password) {
        Toast.show({ content: t("auth.fillAllFields"), position: "center" });
        return;
      }
      await register(username, email, password);
    }
  };

  useEffect(() => {
    if (error) {
      Toast.show({ content: error, position: "center" });
    }
  }, [error]);

  return (
    <div
      className="page-container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--feiyu-bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "var(--feiyu-card)",
          borderRadius: "16px",
          padding: "32px 24px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--feiyu-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "24px",
              fontWeight: "bold",
              margin: "0 auto 12px",
            }}
          >
            F
          </div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "var(--feiyu-text)",
              margin: 0,
            }}
          >
            {t("app.name")}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--feiyu-text-muted)",
              marginTop: "8px",
            }}
          >
            {isLogin ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {!isLogin && (
            <Input
              placeholder={t("auth.username")}
              value={username}
              onChange={setUsername}
              style={{
                "--font-size": "16px",
                padding: "12px",
                border: "1px solid var(--feiyu-border)",
                borderRadius: "8px",
              }}
            />
          )}
          <Input
            placeholder={t("auth.email")}
            value={email}
            onChange={setEmail}
            type="email"
            style={{
              "--font-size": "16px",
              padding: "12px",
              border: "1px solid var(--feiyu-border)",
              borderRadius: "8px",
            }}
          />
          <Input
            placeholder={t("auth.password")}
            value={password}
            onChange={setPassword}
            type="password"
            style={{
              "--font-size": "16px",
              padding: "12px",
              border: "1px solid var(--feiyu-border)",
              borderRadius: "8px",
            }}
          />
          {error && (
            <p style={{ color: "var(--feiyu-danger)", fontSize: "12px", margin: 0 }}>
              {error}
            </p>
          )}
          <Button
            block
            color="primary"
            size="large"
            loading={isLoading}
            onClick={handleSubmit}
            style={{
              marginTop: "8px",
              borderRadius: "8px",
              height: "44px",
            }}
          >
            {isLoading
              ? t("auth.pleaseWait")
              : isLogin
              ? t("auth.login")
              : t("auth.register")}
          </Button>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--feiyu-border)",
            marginTop: "16px",
            paddingTop: "12px",
          }}
        >
          <div
            onClick={() => setShowServerSettings(!showServerSettings)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              color: "var(--feiyu-text-muted)",
              fontSize: "14px",
            }}
          >
            <span>{t("auth.serverSettings")}</span>
            <span style={{ transform: showServerSettings ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              ▼
            </span>
          </div>
          
          {showServerSettings && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Input
                value={serverUrlState}
                onChange={(val) => {
                  setServerUrlState(val);
                  setTestState("idle");
                  setTestMsg("");
                }}
                onBlur={handleServerUrlBlur}
                placeholder={getDefaultServerUrl()}
                style={{
                  "--font-size": "14px",
                  padding: "8px 12px",
                  border: "1px solid var(--feiyu-border)",
                  borderRadius: "8px",
                }}
              />
              {urlError && (
                <p style={{ color: "var(--feiyu-danger)", fontSize: "12px", margin: 0 }}>
                  {t(`auth.urlError.${urlError}`)}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Button
                  size="small"
                  onClick={handleTestConnection}
                  disabled={testState === "testing"}
                  style={{
                    fontSize: "12px",
                    padding: "4px 12px",
                    borderRadius: "4px",
                  }}
                >
                  {testState === "testing" ? t("auth.testing") : t("auth.testConnection")}
                </Button>
                {testState === "ok" && (
                  <span style={{ color: "var(--feiyu-success)", fontSize: "12px" }}>
                    ✓ {t("auth.connectionOk")}
                  </span>
                )}
                {testState === "fail" && (
                  <span style={{ color: "var(--feiyu-danger)", fontSize: "12px" }}>
                    ✗ {t("auth.connectionFailed")}
                    {testMsg ? `: ${testMsg}` : ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "16px",
            fontSize: "14px",
            color: "var(--feiyu-text-muted)",
          }}
        >
          {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
          <span
            onClick={() => navigate(isLogin ? "/register" : "/login")}
            style={{
              color: "var(--feiyu-primary)",
              cursor: "pointer",
            }}
          >
            {isLogin ? t("auth.register") : t("auth.login")}
          </span>
        </p>
      </div>
    </div>
  );
}
