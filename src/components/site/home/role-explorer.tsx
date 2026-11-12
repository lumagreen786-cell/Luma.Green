"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";
import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function RoleExplorer({
  roles,
  label,
}: {
  label: string;
  roles: {
    key: StoryScene;
    title: string;
    description: string;
    action: string;
    actionLabel: string;
    href: string;
  }[];
}) {
  const [selected, setSelected] = useState(roles.at(0)?.key);
  const role = roles.find((item) => item.key === selected) ?? roles.at(0);
  if (!role) return null;
  return (
    <div className="record-sheet overflow-hidden rounded-panel p-3 shadow-panel sm:p-5">
      <Tabs
        orientation="vertical"
        value={role.key}
        onValueChange={(value) => {
          setSelected(roles.find((item) => item.key === value)?.key);
        }}
        className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <TabsList
          aria-label={label}
          className="w-full flex-col bg-transparent p-0"
        >
          {roles.map((item) => (
            <TabsTrigger
              key={item.key}
              value={item.key}
              className={cn(
                "flex min-h-16 min-w-0 items-center gap-3 rounded-full p-2 pe-4 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring",
                item.key === role.key
                  ? "record-detail group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground"
                  : "hover:bg-muted",
              )}
            >
              <RoleStoryImage
                scene={item.key}
                className="size-12 shrink-0"
                frameClassName="aspect-square h-12 rounded-full"
                sizes="48px"
              />
              <span className="min-w-0 flex-1 text-base font-medium">
                {item.title}
              </span>
              <ArrowUpRight
                aria-hidden
                className="size-4 shrink-0 rtl:-scale-x-100"
              />
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value={role.key}
          className="record-detail flex min-w-0 flex-col overflow-hidden rounded-panel"
        >
          <RoleStoryImage
            scene={role.key}
            className="w-full"
            frameClassName="h-40 aspect-auto rounded-none sm:h-48"
            sizes="(min-width:1024px) 650px, 100vw"
          />
          <div className="flex flex-1 flex-col items-start gap-4 p-6 sm:p-8">
            <h3 className="font-display text-2xl font-normal tracking-tight text-foreground">
              {role.title}
            </h3>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              {role.description}
            </p>
            <Button asChild className="mt-auto max-w-full whitespace-normal">
              <Link
                href={role.href}
                aria-label={actionName(role.actionLabel, role.action)}
              >
                {role.actionLabel}
                <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
