"use client";

import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import type { PushSubscriptionDto, PushSubscriptionInput } from "@jobpilot/contracts/push";
import { Delete } from "@mui/icons-material";
import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { SectionCard } from "@/components/ui/layout";
import { useToast } from "@/providers/notification-provider";
import { formatRelativeTime } from "@/utils/format";

/** Decode a VAPID base64url key into the byte array `pushManager.subscribe` expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function PushSettings(): ReactNode {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const vapidQuery = useApiQuery(pilotQueries.pushKey());
  const publicKey = vapidQuery.data?.publicKey ?? null;

  const devicesQuery = useApiQuery(pilotQueries.pushDevices(), {
    enabled: supported && Boolean(publicKey),
  });

  const subscribe = useApiMutation<PushSubscriptionDto, PushSubscriptionInput>(
    (input) => api.push.subscriptions.post(input),
    { invalidate: [queryKeys.pilot.push()] },
  );
  const remove = useApiMutation<{ deleted: string }, string>(
    (endpoint) => api.push.subscriptions.delete({ endpoint }),
    { invalidate: [queryKeys.pilot.push()] },
  );

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (ok) {
      setPermission(Notification.permission);
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.pushManager.getSubscription().then((sub) => setCurrentEndpoint(sub?.endpoint ?? null));
      });
    }
  }, []);

  const enable = async (): Promise<void> => {
    if (!publicKey) {
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Incomplete push subscription");
      }
      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setCurrentEndpoint(sub.endpoint);
    } catch {
      toast.error("Could not enable notifications on this device.");
    } finally {
      setPermission(Notification.permission);
      setBusy(false);
    }
  };

  const removeDevice = async (endpoint: string): Promise<void> => {
    setBusy(true);
    try {
      if (endpoint === currentEndpoint) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        await sub?.unsubscribe();
        setCurrentEndpoint(null);
      }
      await remove.mutateAsync(endpoint);
    } catch {
      toast.error("Could not remove that device.");
    } finally {
      setBusy(false);
    }
  };

  if (vapidQuery.isLoading || !publicKey || !supported) {
    return null;
  }

  const devices = devicesQuery.data ?? [];
  const thisDeviceOn = currentEndpoint !== null;

  let control: ReactElement;
  if (permission === "denied") {
    control = (
      <Typography variant="body2Muted">
        Notifications are blocked for this site. Re-enable them in your browser settings to get
        Pilot alerts here.
      </Typography>
    );
  } else {
    control = (
      <FormControlLabel
        control={
          <Switch
            checked={thisDeviceOn}
            disabled={busy || thisDeviceOn}
            onChange={() => void enable()}
          />
        }
        label={thisDeviceOn ? "Notifications on for this device" : "Turn on for this device"}
      />
    );
  }

  return (
    <SectionCard
      title="Notifications"
      description="Get a push when the Pilot needs you - even when this tab is closed."
    >
      <Stack spacing={2}>
        {control}

        {devices.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="overlineMuted">Registered devices</Typography>
            {devices.map((device) => (
              <Stack
                key={device.id}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="body2" noWrap>
                      {device.userAgent ?? "Unknown device"}
                    </Typography>
                    {device.endpoint === currentEndpoint && (
                      <Chip label="This device" size="small" color="primary" />
                    )}
                  </Stack>
                  <Typography variant="captionMuted">
                    Added {formatRelativeTime(device.createdAt)} ago
                  </Typography>
                </Box>
                <Tooltip title="Remove device">
                  <IconButton
                    size="small"
                    disabled={busy}
                    onClick={() => void removeDevice(device.endpoint)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}

        {devicesQuery.isLoading && <LinearProgress />}
      </Stack>
    </SectionCard>
  );
}
