import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  HOME_REMINDER_NOTIFICATION,
  nextReminderState,
} from "./home-reminder-policy";

const TASK = "luma-household-home-reminder";
const CHANNEL = "household-reminders";
const STORAGE = "luma.household.home-reminder";
const HOME_RADIUS_METRES = 150;

interface Reminder {
  regionId: string;
  armed: boolean;
  title: string;
  body: string;
}

function isReminder(value: unknown): value is Reminder {
  return (
    typeof value === "object" &&
    value !== null &&
    "regionId" in value &&
    typeof value.regionId === "string" &&
    "armed" in value &&
    typeof value.armed === "boolean" &&
    "title" in value &&
    typeof value.title === "string" &&
    "body" in value &&
    typeof value.body === "string"
  );
}

async function reminderOnDevice() {
  const raw = await AsyncStorage.getItem(STORAGE);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  return isReminder(parsed) ? parsed : null;
}

const queue = { previous: Promise.resolve() };

async function inOrder<Result>(work: () => Promise<Result>) {
  const previous = queue.previous;
  const latch: { release?: () => void } = {};
  queue.previous = new Promise<void>((resolve) => {
    latch.release = resolve;
  });
  try {
    await previous;
    return await work();
  } finally {
    latch.release?.();
  }
}

export function registerHomeReminderTask() {
  TaskManager.defineTask<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>(TASK, async ({ data, error }) => {
    if (error) return;
    await inOrder(async () => {
      const saved = await reminderOnDevice();
      if (!saved || saved.regionId !== data.region.identifier) return;
      const { armed, notify } = nextReminderState(
        saved.armed,
        data.eventType === Location.GeofencingEventType.Enter
          ? "enter"
          : "exit",
      );
      if (armed !== saved.armed) {
        await AsyncStorage.setItem(
          STORAGE,
          JSON.stringify({ ...saved, armed }),
        );
      }
      if (notify) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: saved.title,
            body: saved.body,
            data: { kind: HOME_REMINDER_NOTIFICATION },
          },
          trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
        });
      }
    });
  });
}

async function clearReminder() {
  await AsyncStorage.removeItem(STORAGE);
  if (await Location.hasStartedGeofencingAsync(TASK)) {
    await Location.stopGeofencingAsync(TASK);
  }
}

export function hasHomeReminder() {
  return inOrder(async () => {
    const saved = await reminderOnDevice();
    if (!saved) return false;
    const location = await Location.getBackgroundPermissionsAsync();
    const notifications = await Notifications.getPermissionsAsync();
    if (
      !location.granted ||
      !notifications.granted ||
      !(await Location.hasStartedGeofencingAsync(TASK))
    ) {
      await clearReminder();
      return false;
    }
    return true;
  });
}

export function removeHomeReminder() {
  return inOrder(clearReminder);
}

export function enableHomeReminder(title: string, body: string) {
  return inOrder(() => registerHomeReminder(title, body));
}

async function registerHomeReminder(title: string, body: string) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return "unavailable";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: title,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const notifications = await Notifications.requestPermissionsAsync();
  if (!notifications.granted) return "unavailable";
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return "unavailable";
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  if (coords.accuracy === null || coords.accuracy > HOME_RADIUS_METRES / 2) {
    return "unavailable";
  }
  const regionId = `home-${Date.now().toString(36)}`;
  await AsyncStorage.setItem(
    STORAGE,
    JSON.stringify({ regionId, armed: false, title, body }),
  );
  try {
    // The OS stores the region. The app retains no coordinates or event history.
    await Location.startGeofencingAsync(TASK, [
      {
        identifier: regionId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: HOME_RADIUS_METRES,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
  } catch (error) {
    await clearReminder();
    throw error;
  }
  return "enabled";
}
