"use client";

import { CheckCheck, MapPin, Mic, Plus, Smile } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

import { MagicPhone } from "./magic-phone";
import { useIsReducedMotion } from "./motion-preference";
import styles from "./phone.module.css";

export const CONVERSATION_COUNT = 15;
const MESSAGE_COUNT = 8;
const messageKinds = [
  "hello",
  "greeting",
  "photo",
  "askLocation",
  "location",
  "received",
  "accepted",
  "thanks",
] as const;

/** Illustrative conversation only: no customer records or provider calls. */
export function BookingPhone({ className }: { className?: string }) {
  const t = useTranslations("afterlifePhone");
  const root = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const isReduced = useIsReducedMotion();
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [progress, setProgress] = useState({ scenario: 0, count: 1 });
  const count = isReduced ? MESSAGE_COUNT : progress.count;
  const scenario = isReduced ? 0 : progress.scenario;
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    const updateVisibility = () => {
      setDocumentVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (isReduced || !visible || !documentVisible) return;
    const timer = window.setTimeout(
      () => {
        setProgress((previous) =>
          previous.count === MESSAGE_COUNT
            ? {
                scenario: (previous.scenario + 1) % CONVERSATION_COUNT,
                count: 1,
              }
            : { ...previous, count: previous.count + 1 },
        );
      },
      count === MESSAGE_COUNT ? 4500 : 1900,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [count, scenario, isReduced, visible, documentVisible]);
  useEffect(() => {
    const element = feed.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [count, scenario]);
  const slot = t(`scenario${String(scenario)}.slot`);
  const text = {
    hello: t(`scenario${String(scenario)}.hello`),
    greeting: t("greeting"),
    photo: t(`scenario${String(scenario)}.caption`),
    askLocation: t("askLocation"),
    location: t("slotReply", { slot }),
    received: t("received"),
    accepted: t("accepted", { slot }),
    thanks: t("thanks"),
  };
  return (
    <div className={cn(styles.root, className)} ref={root}>
      <span className="sr-only">{t("description")}</span>
      <div aria-hidden="true">
        <MagicPhone>
          <div className={styles.chat}>
            <div className={styles.status} />
            <div className={styles.header}>
              <span className={styles.avatar}>
                <LogoMark idPrefix="phone-preview" className="size-7" />
              </span>
              <strong>{t("name")}</strong>
            </div>
            <div className={styles.feed} ref={feed}>
              {messageKinds.slice(0, count).map((kind, index) => {
                const isOutgoing = [0, 2, 4, 7].includes(index);
                return (
                  <div
                    key={`${String(scenario)}-${kind}`}
                    className={cn(
                      styles.message,
                      isOutgoing && styles.outgoing,
                    )}
                  >
                    {kind === "photo" && (
                      <Image
                        src={
                          [0, 1, 3, 8, 12].includes(scenario)
                            ? "/images/showcase/used-box-recovery.webp"
                            : "/images/showcase/household-sorting.webp"
                        }
                        width={280}
                        height={160}
                        sizes="260px"
                        alt={t("photoAlt")}
                        className={styles.photo}
                      />
                    )}
                    {kind === "location" && (
                      <div className={styles.location}>
                        <div className={styles.map}>
                          <span className={styles.road} />
                          <MapPin size={25} fill="currentColor" />
                        </div>
                        <strong>{t("location")}</strong>
                        <small>{t("locationDetail")}</small>
                      </div>
                    )}
                    <p>{text[kind]}</p>
                    <span className={styles.receipt}>
                      {isOutgoing && <CheckCheck size={14} />}
                    </span>
                  </div>
                );
              })}
              {!isReduced && count < MESSAGE_COUNT && (
                <span className={styles.typing}>
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
            <div className={styles.composer}>
              <Plus size={19} />
              <span>
                {t("message")}
                <Smile size={17} />
              </span>
              <Mic size={19} />
            </div>
          </div>
        </MagicPhone>
      </div>
      <p className={styles.credit}>
        <a href="https://commons.wikimedia.org/wiki/File:Used_Box_Recovery.jpg">
          © Sherways Environmental Packaging
        </a>
        {" · "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        {" · WebP"}
      </p>
    </div>
  );
}
