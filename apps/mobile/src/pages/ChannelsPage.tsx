import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Empty, Button, Dialog, Input, Toast } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useChannelStore } from "../stores/channelStore";
import { Avatar } from "../components/common/Avatar";

export function ChannelsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const channels = useChannelStore((s) => s.channels);
  const loadChannels = useChannelStore((s) => s.loadChannels);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  const handleCreate = async () => {
    if (!newChannelName.trim()) {
      Toast.show({ content: t("channel.nameRequired"), position: "center" });
      return;
    }
    try {
      await useChannelStore.getState().createChannel(newChannelName, newChannelDesc);
      setShowCreateDialog(false);
      setNewChannelName("");
      setNewChannelDesc("");
      await loadChannels();
    } catch (error: any) {
      Toast.show({
        content: error.message || t("channel.createFailed"),
        position: "center",
      });
    }
  };

  return (
    <div>
      <div
        style={{
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "24px", fontWeight: "bold", color: "var(--feiyu-text)" }}>
          {t("tab.channels")}
        </span>
        <Button
          size="small"
          color="primary"
          onClick={() => setShowCreateDialog(true)}
        >
          {t("channel.create")}
        </Button>
      </div>

      {channels.length === 0 ? (
        <Empty description={t("channel.empty")} />
      ) : (
        <List style={{ "--border-top": "none", "--border-bottom": "none" }}>
          {channels.map((channel) => (
            <List.Item
              key={channel.id}
              onClick={() => navigate(`/channels/${channel.id}`)}
              style={{ padding: "12px 16px" }}
              prefix={
                <Avatar
                  name={channel.name}
                  size={48}
                />
              }
              description={
                <span style={{ color: "var(--feiyu-text-muted)", fontSize: "13px" }}>
                  {channel.description || t("channel.noDescription")}
                </span>
              }
              extra={
                <span style={{ color: "var(--feiyu-text-muted)", fontSize: "12px" }}>
                  {channel.member_count || 0} {t("channel.members")}
                </span>
              }
            >
              <span style={{ fontWeight: 500 }}>{channel.name}</span>
            </List.Item>
          ))}
        </List>
      )}

      <Dialog
        visible={showCreateDialog}
        title={t("channel.createTitle")}
        content={
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
            <Input
              placeholder={t("channel.namePlaceholder")}
              value={newChannelName}
              onChange={setNewChannelName}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--feiyu-border)",
                borderRadius: "8px",
              }}
            />
            <Input
              placeholder={t("channel.descPlaceholder")}
              value={newChannelDesc}
              onChange={setNewChannelDesc}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--feiyu-border)",
                borderRadius: "8px",
              }}
            />
          </div>
        }
        closeOnAction
        actions={[
          [
            {
              key: "cancel",
              text: t("common.cancel"),
              onClick: () => setShowCreateDialog(false),
            },
            {
              key: "create",
              text: t("channel.create"),
              bold: true,
              onClick: handleCreate,
            },
          ],
        ]}
      />
    </div>
  );
}
