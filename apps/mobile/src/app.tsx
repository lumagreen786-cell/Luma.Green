import Constants from "expo-constants";
import { getLocales } from "expo-localization";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { localeDirection } from "../../../src/i18n/locales";
import { LocaleProvider, useTranslations } from "./i18n";
import {
  classifyNavigation,
  handleNavigationChange,
  isBotChallengeFrame,
  localeFromLanguage,
  localeFromUrl,
} from "./navigation";
import { recoveryPlan } from "./recovery";
import { runtimeOrigin } from "./runtime-config";
import { theme } from "./theme";
import { usePushNotifications } from "./use-push-notifications";
import { useShellUpdates } from "./use-updates";

const origin = runtimeOrigin(Constants.expoConfig?.extra, __DEV__);
const initialLocale = localeFromLanguage(getLocales()[0].languageTag);

function NativeButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
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
  const t = useTranslations("native");
  const common = useTranslations("common");
  const brand = useTranslations("brand");
  const webView = useRef<WebView>(null);
  const currentUrl = useRef(`${origin}/${initialLocale}`);
  const handoffOpen = useRef(false);
  const [sourceUrl, setSourceUrl] = useState(`${origin}/${initialLocale}`);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const rendererCrashed = useRef(false);
  const updates = useShellUpdates();
  const direction = localeDirection(locale);
  const openInbox = useCallback((url: string) => {
    if (classifyNavigation(url, origin) !== "internal") return;
    // A repeated notification may target the same source prop after in-page
    // navigation. Remount on the explicit tap so it always reaches the inbox.
    rendererCrashed.current = false;
    currentUrl.current = url;
    setFailed(false);
    setLoading(true);
    setSourceUrl(url);
    setWebViewKey((key) => key + 1);
  }, []);
  const push = usePushNotifications({
    origin,
    locale,
    currentUrl,
    webView,
    onOpenInbox: openInbox,
  });

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
        push.invalidate();
        setFailed(false);
        setLoading(true);
        setCanGoBack(false);
        setSourceUrl(currentUrl.current);
        setWebViewKey((key) => key + 1);
      },
      trackTrusted: (trusted) => {
        if (currentUrl.current !== trusted.url) push.invalidate();
        currentUrl.current = trusted.url;
        setCanGoBack(trusted.canGoBack);
        onLocale(localeFromUrl(trusted.url, locale));
      },
    });
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

  const locationPermission = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        Alert.alert(t("locationTitle"), t("locationBody"));
    } catch {
      Alert.alert(common("error"), t("locationBody"));
    }
  };

  const explainLocation = () => {
    Alert.alert(t("locationTitle"), t("locationBody"), [
      { text: t("deny"), style: "cancel" },
      {
        text: t("allow"),
        onPress: () => {
          void locationPermission();
        },
      },
    ]);
  };

  const updateStatus = {
    unavailable: t("updateUnavailable"),
    idle: t("updates"),
    checking: common("loading"),
    ready: t("updateReady"),
    current: t("updateCurrent"),
    failed: t("updateFailed"),
  }[updates.state];

  const showUpdates = () => {
    if (updates.state === "ready") {
      Alert.alert(t("updateReady"), t("restart"), [
        { text: t("later"), style: "cancel" },
        {
          text: t("restart"),
          onPress: () => {
            void updates.restart();
          },
        },
      ]);
    } else {
      void updates.check();
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { direction }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.brand, { writingDirection: direction }]}
        >
          {brand("name")}
        </Text>
        <View style={styles.toolbar}>
          <NativeButton
            label={t("back")}
            disabled={!canGoBack}
            onPress={() => webView.current?.goBack()}
          />
          <NativeButton label={t("reload")} onPress={reload} />
          <NativeButton
            label={t("openBrowser")}
            onPress={() => {
              openExternal(currentUrl.current);
            }}
          />
        </View>
      </View>
      <View style={styles.content}>
        <WebView
          key={webViewKey}
          ref={webView}
          source={{ uri: sourceUrl }}
          style={styles.webView}
          // All requests reach our handler; the library must not auto-open unknown schemes.
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(request) =>
            isBotChallengeFrame(request.url, request.isTopFrame) ||
            isNavigationAllowed(request.url)
          }
          onNavigationStateChange={trackNavigation}
          onMessage={({ nativeEvent }) => {
            void push.receive(nativeEvent.data, nativeEvent.url);
          }}
          onLoadStart={() => {
            push.invalidate();
          }}
          onOpenWindow={({ nativeEvent }) => {
            if (isNavigationAllowed(nativeEvent.targetUrl))
              setSourceUrl(nativeEvent.targetUrl);
          }}
          onLoadProgress={({ nativeEvent }) => {
            setLoading(nativeEvent.progress < 1);
          }}
          onLoadEnd={() => {
            setLoading(false);
            push.ready();
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
              color={theme.primary}
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
              onPress={() => {
                openExternal(currentUrl.current);
              }}
            />
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.toolbar}>
          <NativeButton label={t("locationTitle")} onPress={explainLocation} />
          <NativeButton
            label={t(updates.state === "ready" ? "restart" : "updates")}
            disabled={
              updates.state === "unavailable" || updates.state === "checking"
            }
            onPress={showUpdates}
          />
        </View>
        <Text
          style={[styles.status, { writingDirection: direction }]}
          accessibilityLiveRegion="polite"
        >
          {updateStatus}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  brand: {
    color: theme.foreground,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "center",
  },
  button: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: { backgroundColor: theme.muted },
  disabled: { opacity: 0.45 },
  content: { flex: 1 },
  webView: { flex: 1, backgroundColor: theme.background },
  loading: {
    position: "absolute",
    top: 8,
    end: 12,
    padding: 8,
    borderRadius: 20,
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
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: theme.foreground,
    fontSize: 16,
    textAlign: "center",
    maxWidth: 420,
  },
  footer: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  status: {
    color: theme.primary,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
});
