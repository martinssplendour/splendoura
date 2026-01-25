"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import * as Location from "expo-location";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const LOCATION_UPDATE_THRESHOLD = 0.001;

type PermissionStatus = "undetermined" | "granted" | "denied";

type LocationGateProps = {
  children: ReactNode;
};

export function LocationGate({ children }: LocationGateProps) {
  const { accessToken, user, refreshSession } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [placemark, setPlacemark] = useState<Location.LocationGeocodedAddress | null>(null);
  const lastUpdateRef = useRef<string | null>(null);

  const ensureLocation = useCallback(async (shouldRequest: boolean) => {
    setIsChecking(true);
    setLocationError(null);
    try {
      let status = (await Location.getForegroundPermissionsAsync()).status as PermissionStatus;
      if (status !== "granted" && shouldRequest) {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status as PermissionStatus;
      }
      setPermissionStatus(status);
      if (status !== "granted") {
        setIsChecking(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(position.coords);
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setPlacemark(geo ?? null);
      } catch {
        setPlacemark(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to get your location. Please try again.";
      setLocationError(message);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (typeof Linking.openSettings === "function") {
      void Linking.openSettings();
    }
  }, []);

  useEffect(() => {
    void ensureLocation(true);
  }, [ensureLocation]);

  useEffect(() => {
    if (!coords || !accessToken || !user) return;
    const latDiff =
      user.location_lat == null
        ? Number.POSITIVE_INFINITY
        : Math.abs(user.location_lat - coords.latitude);
    const lngDiff =
      user.location_lng == null
        ? Number.POSITIVE_INFINITY
        : Math.abs(user.location_lng - coords.longitude);
    const nextCity = placemark?.city || placemark?.subregion || placemark?.region;
    const nextCountry = placemark?.country;
    const needsCoords =
      user.location_lat == null ||
      user.location_lng == null ||
      latDiff > LOCATION_UPDATE_THRESHOLD ||
      lngDiff > LOCATION_UPDATE_THRESHOLD;
    const needsCity = !user.location_city && Boolean(nextCity);
    const needsCountry = !user.location_country && Boolean(nextCountry);

    if (!needsCoords && !needsCity && !needsCountry) return;

    const updateKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}:${nextCity ?? ""}:${nextCountry ?? ""}`;
    if (lastUpdateRef.current === updateKey) return;
    lastUpdateRef.current = updateKey;

    const payload: Record<string, unknown> = {
      location_lat: coords.latitude,
      location_lng: coords.longitude,
    };
    if (nextCity) payload.location_city = nextCity;
    if (nextCountry) payload.location_country = nextCountry;

    const updateLocation = async () => {
      const res = await apiFetch("/users/me", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await refreshSession();
      }
    };
    void updateLocation();
  }, [accessToken, coords, placemark, refreshSession, user]);

  const statusMessage = useMemo(() => {
    if (permissionStatus === "denied") {
      return "Location access is required to use Splendoura.";
    }
    if (locationError) {
      return locationError;
    }
    return "Checking your location permission...";
  }, [locationError, permissionStatus]);

  if (permissionStatus === "granted" && coords && !isChecking) {
    return <>{children}</>;
  }

  return (
    <View style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>Enable location to continue</Text>
        <Text style={styles.subtitle}>
          We use your real location to show accurate groups and filters.
        </Text>
        <Text style={styles.status}>{statusMessage}</Text>
        {isChecking ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : (
          <View style={styles.actions}>
            <Button onPress={() => ensureLocation(true)}>
              {permissionStatus === "granted" ? "Retry location" : "Allow location"}
            </Button>
            <Button variant="outline" onPress={handleOpenSettings}>
              Open settings
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  status: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 10,
  },
});
