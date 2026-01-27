"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const LOCATION_UPDATE_THRESHOLD = 0.001;

type PermissionStatus = "undetermined" | "granted" | "denied";

interface LocationGateProps {
  children: ReactNode;
}

export default function LocationGate({ children }: LocationGateProps) {
  const { accessToken, user, refreshSession } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const lastUpdateRef = useRef<string | null>(null);

  const ensureLocation = useCallback((shouldRequest: boolean) => {
    setIsChecking(true);
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setPermissionStatus("denied");
      setLocationError("Geolocation is not supported by this browser.");
      setIsChecking(false);
      return;
    }

    if (!shouldRequest) {
      setIsChecking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionStatus("granted");
        setCoords(position.coords);
        setIsChecking(false);
      },
      (error) => {
        setPermissionStatus("denied");
        setLocationError(error.message || "Unable to get your location.");
        setIsChecking(false);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 15000,
      }
    );
  }, []);

  useEffect(() => {
    let active = true;
    if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (!active) return;
          if (status.state === "granted") {
            setPermissionStatus("granted");
            ensureLocation(true);
            return;
          }
          if (status.state === "denied") {
            setPermissionStatus("denied");
            setIsChecking(false);
            return;
          }
          setPermissionStatus("undetermined");
          ensureLocation(true);
        })
        .catch(() => {
          if (!active) return;
          ensureLocation(true);
        });
    } else {
      ensureLocation(true);
    }

    return () => {
      active = false;
    };
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
    const needsCoords =
      user.location_lat == null ||
      user.location_lng == null ||
      latDiff > LOCATION_UPDATE_THRESHOLD ||
      lngDiff > LOCATION_UPDATE_THRESHOLD;

    if (!needsCoords) return;

    const updateKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
    if (lastUpdateRef.current === updateKey) return;
    lastUpdateRef.current = updateKey;

    const payload: Record<string, unknown> = {
      location_lat: coords.latitude,
      location_lng: coords.longitude,
    };

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
  }, [accessToken, coords, refreshSession, user]);

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
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Enable location to continue</h2>
        <p className="mt-2 text-sm text-slate-600">
          We use your real location to show accurate groups and filters.
        </p>
        <p className="mt-3 text-xs text-slate-500">{statusMessage}</p>
        <div className="mt-5 flex flex-col gap-3">
          <Button
            onClick={() => ensureLocation(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {permissionStatus === "granted" ? "Retry location" : "Allow location"}
          </Button>
          <Button variant="outline" onClick={() => ensureLocation(true)}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
