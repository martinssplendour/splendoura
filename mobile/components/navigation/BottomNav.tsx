"use client";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const BOTTOM_NAV_HEIGHT = 72;
const NAV_VERTICAL_OFFSET = 0;

const NAV_ITEMS: { key: string; label: string; path: string }[] = [
  { key: "discover", label: "Discover", path: "/groups" },
  { key: "chat", label: "Chats", path: "/chat" },
  { key: "requests", label: "Notifications", path: "/requests" },
  { key: "profile", label: "Profile", path: "/profile" },
];

const isActivePath = (pathname: string, path: string) => {
  if (path === "/groups") return pathname.startsWith("/groups");
  if (path === "/chat") return pathname.startsWith("/chat");
  if (path === "/requests") return pathname.startsWith("/requests");
  if (path === "/profile") return pathname.startsWith("/profile");
  return pathname === path;
};

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { height: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
      <View style={styles.content}>
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.path);
          return (
              <Pressable
                key={item.key}
                onPress={() => router.push(item.path as never)}
                style={[styles.item, active ? styles.itemActive : null]}
              >
              <Text style={[styles.label, active ? styles.labelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    transform: [{ translateY: NAV_VERTICAL_OFFSET }],
  },
  content: {
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  itemActive: {
    backgroundColor: "#e2e8f0",
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  labelActive: {
    color: "#0f172a",
  },
});
