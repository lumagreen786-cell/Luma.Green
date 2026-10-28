"use client";

import { useAction, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";

interface Point {
  lat: number;
  lng: number;
}
interface Candidate {
  address: string;
  allowAddressSave: boolean;
}
type State =
  | { status: "idle" | "loading" | "unavailable" }
  | ({ status: "found" } & Candidate);

/** One transient suggestion, discarded on point/address changes and unmount. */
export function useReverseAddress(point: Point | undefined, address: string) {
  const reverse = useAction(api.geocoding.reverse);
  const language = useLocale();
  const profile = useQuery(api.identity.me);
  const session = authClient.useSession();
  const identityKey = JSON.stringify([
    session.data?.user.id,
    session.data?.session.id,
    profile?.phone,
  ]);
  const key = JSON.stringify([
    point?.lat,
    point?.lng,
    language,
    address,
    identityKey,
  ]);
  const [stored, setStored] = useState<{ key: string; value: State }>({
    key: "",
    value: { status: "idle" },
  });
  const generation = useRef(0);
  const busy = useRef(false);
  const cache = useRef<{ key: string; value: Candidate } | undefined>(
    undefined,
  );
  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    cache.current = undefined;
    return () => {
      generation.current += 1;
    };
  }, [key]);

  const lookup = useCallback(async () => {
    if (!point || busy.current) return;
    if (cache.current?.key === key) {
      setStored({ key, value: { status: "found", ...cache.current.value } });
      return;
    }
    busy.current = true;
    const current = generation.current;
    setStored({ key, value: { status: "loading" } });
    try {
      const result = await reverse({ ...point, language, consent: true });
      if (current !== generation.current) return;
      if (result.status === "found") {
        cache.current = {
          key,
          value: {
            address: result.address,
            allowAddressSave: result.allowAddressSave,
          },
        };
        setStored({ key, value: { status: "found", ...cache.current.value } });
      } else setStored({ key, value: { status: "unavailable" } });
    } catch {
      if (current === generation.current)
        setStored({ key, value: { status: "unavailable" } });
    } finally {
      if (current === generation.current) busy.current = false;
    }
  }, [point, key, reverse, language]);
  const state: State = stored.key === key ? stored.value : { status: "idle" };
  return { state, lookup, identityKey };
}
