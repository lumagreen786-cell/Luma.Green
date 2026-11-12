import Constants from "expo-constants";
import { getLocales } from "expo-localization";
import { StatusBar } from "expo-status-bar";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { localeDirection } from "../../../src/i18n/locales";
import {
  enableHomeReminder,
  hasHomeReminder,
  removeHomeReminder,
} from "./home-reminder";
import { isHouseholdSettings } from "./home-reminder-policy";
import { LocaleProvider, useTranslations } from "./i18n";
import { messageBridgeScript, parseNativeMessage } from "./message-bridge";
import {
  classifyNavigation,
  handleNavigationChange,
  isBotChallengeFrame,
  localeFromLanguage,
  localeFromUrl,
} from "./navigation";
import { recoveryPlan } from "./recovery";
import { runtimeOrigin } from "./runtime-config";
import {
  appearanceBridgeScript,
  appearanceMessage,
  type NativeAppearance,
  type NativeTheme,
  shellAppearance,
  themes,
} from "./theme";
import { useNativeLocation } from "./use-native-location";
import { useNativeUpdates } from "./use-native-updates";
import { usePushNotifications } from "./use-push-notifications";

const origin = runtimeOrigin(Constants.expoConfig?.extra, __DEV__);
const areRemindersEnabled =
  Constants.expoConfig?.extra?.areRemindersEnabled === true;
const initialLocale = localeFromLanguage(getLocales()[0].languageTag);

const AppearanceContext = createContext<NativeAppearance>("light");

function NativeButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const appearance = useContext(AppearanceContext);
  const styles = themedStyles[appearance];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && styles.secondaryButtonText]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [locale, setLocale] = useState(initialLocale);
  return (
    <SafeAreaProvider>
      <LocaleProvider locale={locale}>
        <Shell locale={locale} onLocale={setLocale} />
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function Shell({
  locale,
  onLocale,
}: {
  locale: ReturnType<typeof localeFromLanguage>;
  onLocale: (locale: ReturnType<typeof localeFromLanguage>) => void;
}) {
  const systemAppearance = useColorScheme();
  const [webAppearance, setWebAppearance] = useState<NativeAppearance | null>(
    null,
  );
  const {
    colors: theme,
    statusBar,
    appearance,
  } = shellAppearance(webAppearance ?? systemAppearance);
  const styles = themedStyles[appearance];
  const t = useTranslations("native");
  const common = useTranslations("common");
  const reminder = useTranslations("homeReminder");
  const [reminderScreen, setReminderScreen] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const webView = useRef<WebView>(null);
  const currentUrl = useRef(`${origin}/${initialLocale}`);
  const handoffOpen = useRef(false);
  const [sourceUrl, setSourceUrl] = useState(`${origin}/${initialLocale}`);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const rendererCrashed = useRef(false);
  const direction = localeDirection(locale);
  const location = useNativeLocation({ origin, currentUrl, webView });
  const invalidateLocation = location.invalidate;
  const updates = useNativeUpdates({ origin, currentUrl, webView });
  const invalidateUpdates = updates.invalidate;
  const openInbox = useCallback(
    (url: string) => {
      if (classifyNavigation(url, origin) !== "internal") return;
      invalidateLocation();
      invalidateUpdates();
      // A repeated notification may target the same source prop after in-page
      // navigation. Remount on the explicit tap so it always reaches the inbox.
      rendererCrashed.current = false;
      currentUrl.current = url;
      setFailed(false);
      setLoading(true);
      setSourceUrl(url);
      setWebViewKey((key) => key + 1);
    },
    [invalidateLocation, invalidateUpdates],
  );
  const push = usePushNotifications({
    origin,
    locale,
    currentUrl,
    webView,
    onOpenInbox: openInbox,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        webView.current?.injectJavaScript(appearanceBridgeScript(origin));
        return;
      }
      if (state !== "background") return;
      invalidateLocation();
      invalidateUpdates();
      push.invalidate();
    });
    return () => {
      subscription.remove();
    };
  }, [invalidateLocation, invalidateUpdates, push]);

  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      webView.current?.goBack();
      return true;
    });
    return () => {
      listener.remove();
    };
  }, [canGoBack]);

  const openExternal = useCallback(
    (url: string) => {
      const decision = classifyNavigation(url, origin);
      if (decision === "blocked" || handoffOpen.current) return;
      handoffOpen.current = true;
      const close = () => {
        handoffOpen.current = false;
      };
      Alert.alert(
        t("openBrowser"),
        t("browserNotice"),
        [
          { text: common("cancel"), style: "cancel", onPress: close },
          {
            text: t("openBrowser"),
            onPress: () => {
              close();
              void Linking.openURL(url).catch(() => {
                Alert.alert(common("error"));
              });
            },
          },
        ],
        { cancelable: true, onDismiss: close },
      );
    },
    [common, t],
  );

  const isNavigationAllowed = (url: string): boolean => {
    const decision = classifyNavigation(url, origin);
    if (decision === "internal") return true;
    if (decision !== "blocked") openExternal(url);
    return false;
  };

  const trackNavigation = (state: WebViewNavigation) => {
    handleNavigationChange(state, origin, {
      stopLoading: () => webView.current?.stopLoading(),
      openExternal,
      restoreTrusted: () => {
        invalidateUpdates();
        push.invalidate();
        invalidateLocation();
        setFailed(false);
        setLoading(true);
        setCanGoBack(false);
        setSourceUrl(currentUrl.current);
        setWebViewKey((key) => key + 1);
      },
      trackTrusted: (trusted) => {
        if (currentUrl.current !== trusted.url) {
          invalidateUpdates();
          push.invalidate();
          invalidateLocation();
        }
        currentUrl.current = trusted.url;
        if (areRemindersEnabled) {
          setReminderScreen(isHouseholdSettings(trusted.url, origin));
        }
        setCanGoBack(trusted.canGoBack);
        onLocale(localeFromUrl(trusted.url, locale));
      },
    });
  };

  useEffect(() => {
    if (!areRemindersEnabled) return;
    let isOpen = true;
    const refresh = () => {
      void hasHomeReminder()
        .then((enabled) => {
          if (isOpen) setReminderOn(enabled);
        })
        .catch(() => {
          if (isOpen) setReminderOn(false);
        });
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      isOpen = false;
      subscription.remove();
    };
  }, []);

  const changeReminder = async (shouldEnable: boolean) => {
    setReminderBusy(true);
    try {
      if (shouldEnable) {
        const result = await enableHomeReminder(
          reminder("notificationTitle"),
          reminder("notificationBody"),
        );
        setReminderOn(result === "enabled");
        if (result !== "enabled") Alert.alert(reminder("unavailable"));
      } else {
        await removeHomeReminder();
        setReminderOn(false);
      }
    } catch {
      Alert.alert(reminder("unavailable"));
    } finally {
      setReminderBusy(false);
    }
  };

  const promptReminder = () => {
    if (reminderOn) {
      void changeReminder(false);
      return;
    }
    Alert.alert(
      reminder("title"),
      reminder("consent"),
      [
        { text: common("cancel"), style: "cancel" },
        {
          text: reminder("enable"),
          onPress: () => {
            void changeReminder(true);
          },
        },
      ],
      { cancelable: true },
    );
  };

  const reload = () => {
    setFailed(false);
    setLoading(true);
    const plan = recoveryPlan(
      rendererCrashed.current,
      currentUrl.current,
      origin,
      locale,
    );
    if (plan.action === "remount") {
      rendererCrashed.current = false;
      setSourceUrl(plan.uri);
      setWebViewKey((key) => key + 1);
    } else {
      webView.current?.reload();
    }
  };

  return (
    <AppearanceContext.Provider value={appearance}>
      <SafeAreaView style={[styles.screen, { direction }]}>
        <StatusBar style={statusBar} />
        <View style={styles.content}>
          <WebView
            key={webViewKey}
            ref={webView}
            source={{ uri: sourceUrl }}
            style={styles.webView}
            forceDarkOn={false}
            // All requests reach our handler; the library must not auto-open unknown schemes.
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(request) =>
              isBotChallengeFrame(request.url, request.isTopFrame) ||
              isNavigationAllowed(request.url)
            }
            onNavigationStateChange={trackNavigation}
            injectedJavaScriptBeforeContentLoaded={
              messageBridgeScript(origin, Constants.sessionId) +
              appearanceBridgeScript(origin) +
              location.script +
              updates.script
            }
            injectedJavaScript={
              messageBridgeScript(origin, Constants.sessionId) +
              appearanceBridgeScript(origin) +
              location.script +
              updates.script
            }
            injectedJavaScriptForMainFrameOnly
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly
            onMessage={({ nativeEvent }) => {
              if (AppState.currentState !== "active") return;
              const data = parseNativeMessage(
                nativeEvent.data,
                nativeEvent.url,
                currentUrl.current,
                origin,
                Constants.sessionId,
                Platform.OS === "android",
              );
              if (data === null) return;
              const nextAppearance = appearanceMessage(data);
              if (nextAppearance) {
                setWebAppearance(nextAppearance);
                return;
              }
              void location.receive(data, currentUrl.current);
              void push.receive(data, currentUrl.current);
              void updates.receive(data, currentUrl.current);
            }}
            onLoadStart={() => {
              invalidateUpdates();
              push.invalidate();
              invalidateLocation();
            }}
            onOpenWindow={({ nativeEvent }) => {
              if (isNavigationAllowed(nativeEvent.targetUrl))
                setSourceUrl(nativeEvent.targetUrl);
            }}
            onLoadProgress={({ nativeEvent }) => {
              setLoading(nativeEvent.progress < 1);
            }}
            onLoadEnd={() => {
              webView.current?.injectJavaScript(
                messageBridgeScript(origin, Constants.sessionId) +
                  appearanceBridgeScript(origin) +
                  location.script,
              );
              setLoading(false);
              push.ready();
              updates.ready();
            }}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
            onHttpError={({ nativeEvent }) => {
              if (
                nativeEvent.url === currentUrl.current ||
                nativeEvent.url === sourceUrl
              )
                setFailed(true);
            }}
            onContentProcessDidTerminate={() => {
              setFailed(true);
            }}
            onRenderProcessGone={() => {
              rendererCrashed.current = true;
              setFailed(true);
            }}
            renderError={() => <View />}
            onFileDownload={() => {
              openExternal(currentUrl.current);
            }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled={false}
            incognito={false}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback={false}
            mediaPlaybackRequiresUserAction
            javaScriptCanOpenWindowsAutomatically={false}
            mixedContentMode="never"
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            webviewDebuggingEnabled={__DEV__}
          />
          {loading && !failed && (
            <View
              style={styles.loading}
              pointerEvents="none"
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator
                color={theme.indicator}
                accessibilityLabel={common("loading")}
              />
            </View>
          )}
          {failed && (
            <View style={styles.error}>
              <Text accessibilityRole="header" style={styles.errorTitle}>
                {t("offlineTitle")}
              </Text>
              <Text style={styles.errorText}>{t("offlineBody")}</Text>
              <NativeButton label={common("retry")} onPress={reload} />
              <NativeButton
                label={t("openBrowser")}
                secondary
                onPress={() => {
                  openExternal(currentUrl.current);
                }}
              />
            </View>
          )}
        </View>
        {reminderScreen && !failed && !loading ? (
          <NativeButton
            label={reminder(reminderOn ? "disable" : "enable")}
            disabled={reminderBusy}
            onPress={promptReminder}
          />
        ) : null}
      </SafeAreaView>
    </AppearanceContext.Provider>
  );
}

const createStyles = (theme: NativeTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    button: {
      minHeight: 48,
      width: "100%",
      maxWidth: 360,
      backgroundColor: theme.primary,
      borderWidth: 1,
      borderColor: theme.primary,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
    },
    secondaryButton: {
      backgroundColor: theme.background,
      borderColor: theme.border,
    },
    buttonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    secondaryButtonText: { color: theme.foreground },
    pressed: { opacity: 0.76 },
    disabled: { opacity: 0.45 },
    content: { flex: 1 },
    webView: { flex: 1, backgroundColor: theme.background },
    loading: {
      position: "absolute",
      top: 8,
      end: 12,
      padding: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    error: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      gap: 12,
    },
    errorTitle: {
      color: theme.foreground,
      fontSize: 26,
      fontWeight: "700",
      textAlign: "center",
    },
    errorText: {
      color: theme.foreground,
      fontSize: 16,
      lineHeight: 25,
      marginBottom: 12,
      textAlign: "center",
      maxWidth: 420,
    },
  });

const themedStyles = {
  light: createStyles(themes.light),
  dark: createStyles(themes.dark),
};
