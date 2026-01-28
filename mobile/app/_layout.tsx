import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/auth-context";
import { LocationGate } from "@/components/LocationGate";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

const UI_SCALE = Platform.OS === "android" ? 1 : 0.9;
const INV_SCALE = 1 / UI_SCALE;
const COMPACT_HEADER_OPTIONS = {
  headerStyle: { backgroundColor: "#ffffff" },
  headerBackTitleVisible: false,
};

function ScaledApp({ children }: { children: ReactNode }) {
  const scaledSize = `${INV_SCALE * 100}%`;

  return (
    <View style={styles.scaleRoot}>
      <View
        style={[
          styles.scaleLayer,
          { width: scaledSize, height: scaledSize, transform: [{ scale: UI_SCALE }] },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ScaledApp>
          <LocationGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: "#ffffff" },
                headerShadowVisible: false,
                headerTitleStyle: { fontSize: 15, fontWeight: "600" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="auth/login" options={{ title: "Sign In" }} />
              <Stack.Screen name="auth/register" options={{ title: "Create Account" }} />
              <Stack.Screen name="groups/index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
              <Stack.Screen name="groups/create" options={{ title: "Create Group" }} />
              <Stack.Screen name="groups/[id]" options={{ title: "Group" }} />
              <Stack.Screen name="chat/index" options={{ title: "Chats" }} />
              <Stack.Screen name="chat/[id]" options={{ title: "Chat", ...COMPACT_HEADER_OPTIONS }} />
              <Stack.Screen name="chat/[id]/call" options={{ headerShown: false }} />
              <Stack.Screen name="profile/index" options={{ title: "Profile", ...COMPACT_HEADER_OPTIONS }} />
              <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
              <Stack.Screen name="requests/index" options={{ title: "Join Requests", ...COMPACT_HEADER_OPTIONS }} />
              <Stack.Screen name="safety/index" options={{ title: "Safety Center" }} />
              <Stack.Screen name="users/[id]" options={{ title: "User" }} />
              <Stack.Screen name="admin/verification" options={{ title: "Verification" }} />
            </Stack>
          </LocationGate>
        </ScaledApp>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scaleRoot: {
    flex: 1,
  },
  scaleLayer: {
    alignSelf: "center",
  },
});
