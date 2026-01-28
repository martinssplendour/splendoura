"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch, API_HOST, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { buildFormFile, type UploadAsset } from "@/lib/uploads";

interface ChatGroup {
  id: number;
  title: string;
  activity_type: string;
  location?: string | null;
  approved_members?: number | null;
  max_participants?: number | null;
}

interface GroupMessage {
  id: number;
  sender_id: number;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  message_type?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  read_by?: number[];
}

interface MemberProfile {
  id: number;
  username?: string | null;
  full_name?: string | null;
}

type MessageListItem =
  | { type: "single"; message: GroupMessage }
  | { type: "gallery"; messages: GroupMessage[] };

export const options = {
  headerStyle: { backgroundColor: "#ffffff", height: 3 },
  headerBackTitleVisible: false,
};

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user, isLoading } = useAuth();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState<UploadAsset | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [revealedImages, setRevealedImages] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [memberNames, setMemberNames] = useState<Record<number, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const groupId = useMemo(() => Number(params.id), [params.id]);
  const isVerified = user?.verification_status === "verified";
  const blockNudity = Boolean(
    (user?.profile_details as Record<string, unknown> | null)?.safety_settings &&
      ((user?.profile_details as Record<string, unknown>).safety_settings as Record<string, unknown>)
        ?.block_nudity
  );
  const hasGroupId = Number.isFinite(groupId) && groupId > 0;
  const showSend = Boolean(messageText.trim()) || Boolean(attachment);
  const canSend = isVerified && hasGroupId && !isSending && showSend;
  const formatTime = useCallback(
    (value: string) =>
      new Date(value).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    []
  );

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(`/groups/${groupId}`, accessToken ? { token: accessToken } : undefined);
    if (res.ok) {
      setGroup(await res.json());
    }
  }, [accessToken, groupId]);

  const markMessagesRead = useCallback(
    async (messageIds: number[]) => {
      if (!accessToken || !groupId || messageIds.length === 0) return;
      await apiFetch(`/groups/${groupId}/messages/read`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ message_ids: messageIds }),
      });
    },
    [accessToken, groupId]
  );

  const loadMessages = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setIsLoadingMessages(true);
    const res = await apiFetch(`/groups/${groupId}/messages`, { token: accessToken });
    if (res.ok) {
      const data: GroupMessage[] = await res.json();
      setMessages(data);
      const unreadIds = data
        .filter((message) => message.sender_id !== user?.id)
        .map((message) => message.id);
      if (unreadIds.length > 0) {
        void markMessagesRead(unreadIds);
      }
    } else {
      setStatus("Unable to load messages for this group.");
    }
    setIsLoadingMessages(false);
  }, [accessToken, groupId, markMessagesRead, user?.id]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const loadMemberNames = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/approved-members`, { token: accessToken });
    if (!res.ok) return;
    const data: MemberProfile[] = await res.json();
    const next: Record<number, string> = {};
    data.forEach((member) => {
      const label = member.username || member.full_name || `User ${member.id}`;
      next[member.id] = label;
    });
    if (user?.id && !next[user.id]) {
      next[user.id] = user.username || user.full_name || "You";
    }
    setMemberNames(next);
  }, [accessToken, groupId, user?.full_name, user?.id, user?.username]);

  useEffect(() => {
    loadMemberNames();
  }, [loadMemberNames]);

  useEffect(() => {
    if (!accessToken || !groupId) return;
    const base = API_HOST.replace(/^http/, "ws");
    const wsUrl = `${base}/api/v1/ws/groups/${groupId}?token=${accessToken}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      let payload: {
        type?: string;
        user_id?: number;
        is_typing?: boolean;
        message?: GroupMessage;
        message_ids?: number[];
      };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === "message:new" && payload.message) {
        const nextMessage = payload.message;
        setMessages((prev) =>
          prev.some((message) => message.id === nextMessage.id)
            ? prev
            : [...prev, nextMessage]
        );
        if (nextMessage.sender_id !== user?.id) {
          void markMessagesRead([nextMessage.id]);
        }
      }
      if (payload.type === "typing" && payload.user_id) {
        if (payload.user_id === user?.id) return;
        setTypingUsers((prev) => ({
          ...prev,
          [payload.user_id as number]: Boolean(payload.is_typing),
        }));
      }
      if (payload.type === "read" && payload.user_id && payload.message_ids) {
        setMessages((prev) =>
          prev.map((message) => {
            if (!payload.message_ids?.includes(message.id)) return message;
            const existing = message.read_by || [];
            if (existing.includes(payload.user_id as number)) return message;
            return { ...message, read_by: [...existing, payload.user_id as number] };
          })
        );
      }
    };

    socket.onclose = () => {
      setTypingUsers({});
    };

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [accessToken, groupId, markMessagesRead, user?.id]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
  }, []);

  const handleMessageChange = (value: string) => {
    setMessageText(value);
    if (!value.trim()) {
      if (typingActiveRef.current) {
        sendTyping(false);
        typingActiveRef.current = false;
      }
      return;
    }
    if (!typingActiveRef.current) {
      sendTyping(true);
      typingActiveRef.current = true;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
      typingActiveRef.current = false;
    }, 1200);
  };

  const typingLabels = useMemo(() => {
    const activeIds = Object.keys(typingUsers)
      .map((id) => Number(id))
      .filter((id) => typingUsers[id] && id !== user?.id);
    if (activeIds.length === 0) return null;
    const names = activeIds.map((id) => memberNames[id] || `User ${id}`);
    return names.join(", ");
  }, [memberNames, typingUsers, user?.id]);

  const groupedMessages = useMemo<MessageListItem[]>(() => {
    const items: MessageListItem[] = [];
    const isImageOnly = (message: GroupMessage) =>
      Boolean(
        message.attachment_url &&
          message.attachment_type?.startsWith("image/") &&
          !message.content &&
          !(message.meta as Record<string, any> | null)?.call
      );

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (isImageOnly(message)) {
        const group: GroupMessage[] = [message];
        let cursor = index + 1;
        while (
          cursor < messages.length &&
          isImageOnly(messages[cursor]) &&
          messages[cursor].sender_id === message.sender_id
        ) {
          group.push(messages[cursor]);
          cursor += 1;
        }
        if (group.length > 1) {
          items.push({ type: "gallery", messages: group });
          index = cursor - 1;
          continue;
        }
      }
      items.push({ type: "single", message });
    }
    return items;
  }, [messages]);

  const getWarningForMessage = (value: string) => {
    const lowered = value.toLowerCase();
    if (/(cashapp|venmo|paypal|bitcoin|crypto|wire|bank)/i.test(lowered)) {
      return "This message mentions payments. Be careful with money requests.";
    }
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(lowered)) {
      return "You appear to be sharing a phone number. Make sure you trust this person.";
    }
    if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(lowered)) {
      return "You appear to be sharing an email. Only share contact info if you feel safe.";
    }
    if (/(meet|address|home|hotel|room number)/i.test(lowered)) {
      return "Consider meeting in a public place and sharing your plan with a trusted contact.";
    }
    return null;
  };

  const handleSendMessage = async (skipWarning = false) => {
    if (!accessToken || !groupId) return;
    if (!isVerified) {
      setStatus("Verify your profile before sending messages.");
      return;
    }
    if (!messageText.trim() && !attachment) {
      setStatus("Write a message or attach a file before sending.");
      return;
    }
    if (!skipWarning && messageText.trim()) {
      const warning = getWarningForMessage(messageText.trim());
      if (warning) {
        setWarningText(warning);
        setShowWarning(true);
        return;
      }
    }
    setIsSending(true);
    setStatus(null);

    const formData = new FormData();
    if (messageText.trim()) {
      formData.append("content", messageText.trim());
    }
    if (attachment) {
      formData.append("file", buildFormFile(attachment) as unknown as Blob);
    }

    try {
      const res = await apiFetch(`/groups/${groupId}/messages`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to send message.");
      }
      const data: GroupMessage = await res.json();
      setMessages((prev) =>
        prev.some((message) => message.id === data.id) ? prev : [...prev, data]
      );
      setMessageText("");
      setAttachment(null);
      if (typingActiveRef.current) {
        sendTyping(false);
        typingActiveRef.current = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message.";
      setStatus(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("Microphone permission is required to record.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recordingInstance = new Audio.Recording();
      await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingInstance.startAsync();
      setRecording(recordingInstance);
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start recording.";
      setStatus(message);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setAttachment({
          uri,
          name: `voice-note-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to stop recording.";
      setStatus(message);
    } finally {
      setRecording(null);
      setIsRecording(false);
    }
  };

  const handlePlayAudio = async (url: string, messageId: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === messageId) {
        setPlayingId(null);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      setPlayingId(messageId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlayingId(null);
          void sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to play audio.";
      setStatus(message);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAttachment({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
    });
  };

  const buildCallUrl = (mode: "voice" | "video") =>
    `https://meet.jit.si/splendoura-group-${groupId}?config.startWithVideoMuted=${
      mode === "voice" ? "true" : "false"
    }&config.startAudioOnly=${mode === "voice" ? "true" : "false"}`;

  const handleStartCall = async (mode: "voice" | "video") => {
    if (!accessToken || !groupId) return;
    if (!isVerified) {
      setStatus("Verify your profile before starting calls.");
      return;
    }
    const callUrl = buildCallUrl(mode);
    try {
      const formData = new FormData();
      formData.append(
        "content",
        `${user?.full_name || user?.username || "Someone"} started a ${
          mode === "voice" ? "voice" : "video"
        } call.`
      );
      formData.append("message_type", "system");
      formData.append("metadata", JSON.stringify({ call: { url: callUrl, mode } }));
      await apiFetch(`/groups/${groupId}/messages`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
    } catch {
      // ignore announcement failure
    }
    router.push(`/chat/${groupId}/call?mode=${mode}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.status}>Sign in to view this chat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Pressable
                  onPress={() => {
                    if (groupId) router.push(`/groups/${groupId}`);
                  }}
                  disabled={!groupId}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="View group details"
                >
                  <Text
                    style={[
                      styles.headerTitle,
                      groupId ? styles.headerTitleLink : styles.headerTitleDisabled,
                    ]}
                  >
                    {group?.title || "Loading..."}
                  </Text>
                </Pressable>
                <Text style={styles.headerMeta}>
                  {group?.approved_members ?? 0}/{group?.max_participants ?? "--"} members
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.headerIconButton}
                  onPress={() => handleStartCall("voice")}
                  accessibilityRole="button"
                  accessibilityLabel="Start voice call"
                >
                  <Ionicons name="call-outline" size={18} color="#0f172a" />
                </Pressable>
                <Pressable
                  style={styles.headerIconButton}
                  onPress={() => handleStartCall("video")}
                  accessibilityRole="button"
                  accessibilityLabel="Start video call"
                >
                  <Ionicons name="videocam-outline" size={18} color="#0f172a" />
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.messages}>
              {isLoadingMessages ? (
                <ActivityIndicator size="large" color="#2563eb" />
              ) : messages.length === 0 ? (
                <Text style={styles.empty}>No messages yet. Say hi!</Text>
              ) : (
                groupedMessages.map((item) => {
                  const itemMessages = item.type === "gallery" ? item.messages : [item.message];
                  const primaryMessage = itemMessages[itemMessages.length - 1];
                  const senderId = itemMessages[0].sender_id;
                  const isMine = senderId === user?.id;
                  const readCount = (primaryMessage.read_by || []).filter(
                    (id) => id !== user?.id
                  ).length;
                  const senderLabel =
                    memberNames[senderId] ||
                    (isMine ? user?.username || user?.full_name || "You" : `User ${senderId}`);
                  const isImageOnly =
                    item.type === "gallery" ||
                    Boolean(
                      item.type === "single" &&
                        item.message.attachment_url &&
                        item.message.attachment_type?.startsWith("image/") &&
                        !item.message.content
                    );

                  return (
                    <View
                      key={
                        item.type === "gallery"
                          ? `gallery-${itemMessages[0].id}`
                          : item.message.id
                      }
                      style={[styles.bubbleRow, isMine ? styles.alignEnd : styles.alignStart]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isMine ? styles.mine : styles.theirs,
                          isImageOnly ? styles.imageBubble : null,
                        ]}
                      >
                        {item.type === "single" &&
                        item.message.meta &&
                        (item.message.meta as Record<string, any>).call ? (
                          <Pressable
                            style={styles.callCard}
                            onPress={() => {
                              const callMeta = (item.message.meta as Record<string, any>).call;
                              if (callMeta?.mode) {
                                router.push(`/chat/${groupId}/call?mode=${callMeta.mode}`);
                                return;
                              }
                              if (callMeta?.url) {
                                router.push(`/chat/${groupId}/call?url=${encodeURIComponent(callMeta.url)}`);
                              }
                            }}
                          >
                            <Text style={styles.callTitle}>Join call</Text>
                            <Text style={styles.callMeta}>Tap to open the live room</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => router.push(`/users/${senderId}`)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${senderLabel} profile`}
                        >
                          <Text
                            style={[
                              styles.bubbleSender,
                              isMine ? styles.bubbleSenderMine : styles.bubbleSenderTheirs,
                            ]}
                          >
                            {senderLabel}
                          </Text>
                        </Pressable>
                        {item.type === "gallery" ? (
                          <View style={styles.galleryGrid}>
                            {itemMessages.map((message, index) => {
                              const nudity = (message.meta as Record<string, any> | null)?.nudity;
                              const isSensitive = Boolean(nudity?.contains_nudity);
                              const shouldBlock =
                                blockNudity && isSensitive && !revealedImages[message.id];
                              const isLastInRow = index % 2 === 1;
                              if (shouldBlock) {
                                return (
                                  <Pressable
                                    key={message.id}
                                    style={[
                                      styles.galleryItem,
                                      !isLastInRow ? styles.galleryItemSpacer : null,
                                    ]}
                                    onPress={() =>
                                      setRevealedImages((prev) => ({
                                        ...prev,
                                        [message.id]: true,
                                      }))
                                    }
                                  >
                                    <View style={styles.sensitiveThumb}>
                                      <Text style={styles.sensitiveTitle}>Sensitive</Text>
                                      <Text style={styles.sensitiveHint}>Tap to view</Text>
                                    </View>
                                  </Pressable>
                                );
                              }
                              return (
                                <Pressable
                                  key={message.id}
                                  style={[
                                    styles.galleryItem,
                                    !isLastInRow ? styles.galleryItemSpacer : null,
                                  ]}
                                  onPress={() =>
                                    setFullScreenImage(resolveMediaUrl(message.attachment_url))
                                  }
                                  hitSlop={6}
                                  accessibilityRole="button"
                                  accessibilityLabel="View image"
                                >
                                  <Image
                                    source={{ uri: resolveMediaUrl(message.attachment_url) }}
                                    style={styles.galleryImage}
                                    resizeMode="cover"
                                  />
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}
                        {item.type === "single" && item.message.content ? (
                          <Text
                            style={[
                              styles.bubbleText,
                              isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                            ]}
                          >
                            {item.message.content}
                          </Text>
                        ) : null}
                        {item.type === "single" && item.message.attachment_url ? (
                          item.message.attachment_type?.startsWith("image/") ? (
                            (() => {
                              const nudity = (item.message.meta as Record<string, any> | null)?.nudity;
                              const isSensitive = Boolean(nudity?.contains_nudity);
                              const shouldBlock =
                                blockNudity && isSensitive && !revealedImages[item.message.id];
                              if (shouldBlock) {
                                return (
                                  <Pressable
                                    style={styles.sensitiveCard}
                                    onPress={() =>
                                      setRevealedImages((prev) => ({
                                        ...prev,
                                        [item.message.id]: true,
                                      }))
                                    }
                                  >
                                    <Text style={styles.sensitiveTitle}>Sensitive image hidden</Text>
                                    <Text style={styles.sensitiveHint}>Tap to view</Text>
                                  </Pressable>
                                );
                              }
                              return (
                                <Pressable
                                  onPress={() =>
                                    setFullScreenImage(resolveMediaUrl(item.message.attachment_url))
                                  }
                                  hitSlop={6}
                                  accessibilityRole="button"
                                  accessibilityLabel="View image"
                                >
                                  <Image
                                    source={{ uri: resolveMediaUrl(item.message.attachment_url) }}
                                    style={styles.attachmentImage}
                                    resizeMode="cover"
                                  />
                                </Pressable>
                              );
                            })()
                          ) : item.message.attachment_type?.startsWith("audio/") ? (
                            <Pressable
                              style={styles.audioCard}
                              onPress={() =>
                                handlePlayAudio(
                                  resolveMediaUrl(item.message.attachment_url),
                                  item.message.id
                                )
                              }
                            >
                              <Text style={styles.audioTitle}>
                                {playingId === item.message.id ? "Stop voice note" : "Play voice note"}
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() =>
                                Linking.openURL(resolveMediaUrl(item.message.attachment_url))
                              }
                            >
                              <Text style={styles.attachmentLink}>Open attachment</Text>
                            </Pressable>
                          )
                        ) : null}
                      </View>
                      <View style={[styles.metaRow, isMine ? styles.metaRowMine : styles.metaRowTheirs]}>
                        <Text
                          style={[
                            styles.metaText,
                            isMine ? styles.metaTextMine : styles.metaTextTheirs,
                          ]}
                        >
                          {formatTime(primaryMessage.created_at)}
                        </Text>
                        {isMine && readCount > 0 ? (
                          <Ionicons name="checkmark-done" size={12} color="#60a5fa" />
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {!isVerified ? (
              <View style={styles.verifyBanner}>
                <Text style={styles.verifyText}>Verify your profile to send messages.</Text>
                <Button size="sm" variant="outline" onPress={() => router.push("/profile")}>
                  Verify now
                </Button>
              </View>
            ) : null}

            <View style={styles.composerSection}>
              {typingLabels ? (
                <Text style={styles.typingLabel}>{typingLabels} is typing...</Text>
              ) : null}

              {attachment ? (
                <View style={styles.attachmentRow}>
                  <Text style={styles.attachmentLabel}>
                    Attached: {attachment.name || "file"}
                  </Text>
                  <Pressable onPress={() => setAttachment(null)}>
                    <Text style={styles.attachmentRemove}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composer}>
                <View style={styles.composerActions}>
                  <Pressable
                    style={[
                      styles.iconButton,
                      !isVerified ? styles.iconButtonDisabled : null,
                    ]}
                    onPress={handlePickPhoto}
                    disabled={!isVerified}
                    accessibilityRole="button"
                    accessibilityLabel="Attach photo"
                  >
                    <Ionicons name="add" size={20} color={isVerified ? "#0f172a" : "#cbd5f5"} />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.iconButton,
                      !isVerified ? styles.iconButtonDisabled : null,
                    ]}
                    onPress={handlePickFile}
                    disabled={!isVerified}
                    accessibilityRole="button"
                    accessibilityLabel="Attach file"
                  >
                    <Ionicons name="attach" size={18} color={isVerified ? "#0f172a" : "#cbd5f5"} />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.iconButton,
                      !isVerified ? styles.iconButtonDisabled : null,
                    ]}
                    onPress={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={!isVerified}
                    accessibilityRole="button"
                    accessibilityLabel={isRecording ? "Stop recording" : "Record voice note"}
                  >
                    <Ionicons
                      name={isRecording ? "stop" : "mic"}
                      size={18}
                      color={isVerified ? "#0f172a" : "#cbd5f5"}
                    />
                  </Pressable>
                </View>
                <TextInput
                  value={messageText}
                  onChangeText={handleMessageChange}
                  placeholder={isVerified ? "Type a message" : "Verify to chat"}
                  style={styles.input}
                  multiline
                  editable={isVerified}
                />
                {showSend ? (
                  <Pressable
                    style={[
                      styles.sendButton,
                      !canSend ? styles.iconButtonDisabled : null,
                    ]}
                    onPress={() => handleSendMessage(false)}
                    disabled={!canSend}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#ffffff" />
                    )}
                  </Pressable>
                ) : null}
              </View>
              {status ? <Text style={styles.status}>{status}</Text> : null}
            </View>
          </View>
        </KeyboardAvoidingView>
        <Modal
          visible={Boolean(fullScreenImage)}
          transparent
          animationType="fade"
          onRequestClose={() => setFullScreenImage(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setFullScreenImage(null)}
          >
            {fullScreenImage ? (
              <Image
                source={{ uri: fullScreenImage }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.modalHint}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
        <Modal
          visible={showWarning}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWarning(false)}
        >
          <View style={styles.warningBackdrop}>
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Think twice</Text>
              <Text style={styles.warningText}>{warningText}</Text>
              <View style={styles.warningActions}>
                <Button variant="outline" size="sm" onPress={() => setShowWarning(false)}>
                  Edit
                </Button>
                <Button size="sm" onPress={() => { setShowWarning(false); void handleSendMessage(true); }}>
                  Send anyway
                </Button>
              </View>
            </View>
          </View>
        </Modal>
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerTitleLink: {
    textDecorationLine: "none",
  },
  headerTitleDisabled: {
    color: "#94a3b8",
  },
  headerMeta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  messages: {
    gap: 12,
    paddingVertical: 8,
  },
  bubbleRow: {
    width: "100%",
  },
  alignStart: {
    alignItems: "flex-start",
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  imageBubble: {
    padding: 4,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  mine: {
    backgroundColor: "#2563eb",
  },
  theirs: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bubbleSender: {
    fontSize: 12,
    fontWeight: "700",
  },
  bubbleSenderMine: {
    color: "#dbeafe",
  },
  bubbleSenderTheirs: {
    color: "#475569",
  },
  bubbleText: {
    fontSize: 15,
  },
  bubbleTextMine: {
    color: "#ffffff",
  },
  bubbleTextTheirs: {
    color: "#1e293b",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 6,
  },
  metaRowMine: {
    alignSelf: "flex-end",
  },
  metaRowTheirs: {
    alignSelf: "flex-start",
  },
  metaText: {
    fontSize: 11,
  },
  metaTextMine: {
    color: "#93c5fd",
  },
  metaTextTheirs: {
    color: "#94a3b8",
  },
  attachmentImage: {
    width: 220,
    maxWidth: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  galleryItem: {
    flexBasis: "48%",
    flexGrow: 0,
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 6,
  },
  galleryItemSpacer: {
    marginRight: 6,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  attachmentLink: {
    fontSize: 12,
    color: "#1d4ed8",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  modalImage: {
    width: "100%",
    height: "70%",
    borderRadius: 16,
    backgroundColor: "#0f172a",
  },
  modalHint: {
    fontSize: 12,
    color: "#e2e8f0",
  },
  empty: {
    textAlign: "center",
    color: "#94a3b8",
  },
  composerSection: {
    transform: [{ translateY: -85 }],
  },
  composer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-end",
  },
  composerActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 42,
    backgroundColor: "#ffffff",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  status: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  attachmentLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  attachmentRemove: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  typingLabel: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 6,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  verifyText: {
    fontSize: 12,
    color: "#9a3412",
    flex: 1,
  },
  sensitiveCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  sensitiveThumb: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 8,
  },
  sensitiveTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f8fafc",
  },
  sensitiveHint: {
    fontSize: 11,
    color: "#cbd5f5",
    marginTop: 4,
  },
  audioCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  audioTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730a3",
  },
  callCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    marginBottom: 6,
  },
  callTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0e7490",
  },
  callMeta: {
    fontSize: 11,
    color: "#164e63",
    marginTop: 2,
  },
  warningBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  warningCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  warningText: {
    fontSize: 13,
    color: "#475569",
  },
  warningActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
