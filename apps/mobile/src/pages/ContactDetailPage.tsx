import { useParams, useNavigate } from "react-router-dom";
import { NavBar, Button, List, Toast, Dialog } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useContactStore } from "../stores/contactStore";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/common/Avatar";
import { api } from "../services/api";

interface Contact {
  id: string;
  username: string;
  display_name: string | null;
  email?: string;
  is_online?: boolean;
}

export function ContactDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contacts = useContactStore((s) => s.contacts) as unknown as Contact[];
  const loadContacts = useContactStore((s) => s.loadContacts);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const contact = contacts.find((c) => c.id === id);

  if (!contact) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)}>
          {t("contact.detail")}
        </NavBar>
        <div style={{ padding: "40px", textAlign: "center", color: "var(--feiyu-text-muted)" }}>
          {t("contact.notFound")}
        </div>
      </div>
    );
  }

  const handleStartChat = async () => {
    if (!currentUserId || !id) return;
    try {
      const conversation = await api.createDirectConversation(currentUserId, id);
      navigate(`/chat/${conversation.id}`);
    } catch (error: any) {
      Toast.show({
        content: error.message || t("conversation.createFailed"),
        position: "center",
      });
    }
  };

  const handleRemoveContact = async () => {
    if (!id) return;
    const result = await Dialog.confirm({
      content: t("contact.removeConfirm"),
    });
    if (result) {
      try {
        await api.removeContact(id);
        await loadContacts();
        Toast.show({ content: t("contact.removeSuccess"), position: "center" });
        navigate(-1);
      } catch (error: any) {
        Toast.show({
          content: error.message || t("contact.removeFailed"),
          position: "center",
        });
      }
    }
  };

  return (
    <div className="page-container">
      <NavBar onBack={() => navigate(-1)}>
        {t("contact.detail")}
      </NavBar>

      <div style={{ padding: "24px", textAlign: "center" }}>
        <Avatar
          name={contact.display_name || contact.username}
          size={72}
          online={contact.is_online}
        />
        <h2
          style={{
            marginTop: "12px",
            fontSize: "20px",
            fontWeight: 600,
            color: "var(--feiyu-text)",
          }}
        >
          {contact.display_name || contact.username}
        </h2>
        <p style={{ color: "var(--feiyu-text-muted)", marginTop: "4px" }}>
          {contact.is_online ? t("status.online") : t("status.offline")}
        </p>
      </div>

      <List style={{ marginTop: "12px" }}>
        {contact.email && (
          <List.Item extra={contact.email}>{t("profile.email")}</List.Item>
        )}
        {contact.username && (
          <List.Item extra={`@${contact.username}`}>
            {t("profile.username")}
          </List.Item>
        )}
      </List>

      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <Button block color="primary" size="large" onClick={handleStartChat}>
          {t("contact.startChat")}
        </Button>
        <Button block color="danger" size="large" onClick={handleRemoveContact}>
          {t("contact.remove")}
        </Button>
      </div>
    </div>
  );
}
