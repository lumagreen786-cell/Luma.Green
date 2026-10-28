import * as Updates from "expo-updates";
import { useCallback, useRef, useState } from "react";

import {
  canCheckUpdate,
  canRestartUpdate,
  type UpdateState,
} from "./update-policy";

export function useShellUpdates() {
  const nativeUpdates = Updates.useUpdates();
  const checking = useRef(false);
  const restarting = useRef(false);
  const [checkState, setState] = useState<UpdateState>(
    !__DEV__ && Updates.isEnabled ? "idle" : "unavailable",
  );
  const state: UpdateState =
    checkState !== "failed" && nativeUpdates.isUpdatePending
      ? "ready"
      : checkState;

  const check = useCallback(async () => {
    if (checking.current || !canCheckUpdate(Updates.isEnabled, __DEV__, state))
      return;
    checking.current = true;
    setState("checking");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState("current");
        return;
      }
      const downloaded = await Updates.fetchUpdateAsync();
      setState(downloaded.isNew ? "ready" : "current");
    } catch {
      setState("failed");
    } finally {
      checking.current = false;
    }
  }, [state]);

  const restart = useCallback(
    async (isSafe: boolean) => {
      if (!isSafe || restarting.current || !canRestartUpdate(state, true))
        return;
      restarting.current = true;
      try {
        await Updates.reloadAsync();
      } catch {
        setState("failed");
      } finally {
        restarting.current = false;
      }
    },
    [state],
  );

  return { state, check, restart };
}
