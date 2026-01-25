"use client";

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

export async function registerForPushNotificationsAsync(authToken: string) {
  if (!authToken) return null;
  await ensureAndroidChannel();
  if (!Constants.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;

  let pushToken: string | null = null;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    pushToken = tokenResponse.data;
  } catch {
    return null;
  }

  if (!pushToken) return null;
  const res = await apiFetch("/users/me/push-token", {
    method: "POST",
    token: authToken,
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
    }),
  });
  if (!res.ok) {
    return null;
  }
  return pushToken;
}
