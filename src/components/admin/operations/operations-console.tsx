"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ApartmentRoutes } from "./apartment-routes";
import { CollectionReassignment } from "./collection-reassignment";
import {
  DestinationConsole,
  FacilityReviewConsole,
} from "./compliance-console";
import { DefinitionConsole } from "./definition-console";
export function OperationsConsole() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 pb-2">
        <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Materials, sites and routes
        </h1>
        <p className="text-sm text-muted-foreground">
          Check material definitions and supplied site evidence. Manage
          collection routes below. Regulatory permission stays separate from
          commercial listings.
        </p>
      </div>
      <div className="grid min-w-0 items-start gap-4">
        <Tabs
          defaultValue="definitions"
          className="record-sheet min-w-0 gap-5 rounded-panel p-4 shadow-panel sm:p-6"
        >
          <div className="-mt-4 flex justify-center sm:-mt-6">
            <TabsList className="h-auto max-w-full flex-wrap justify-center gap-2 rounded-t-none rounded-b-[28px] bg-[var(--shell)] p-2 pt-0">
              <TabsTrigger value="definitions">
                Material definitions
              </TabsTrigger>
              <TabsTrigger value="facilities">Facility scope</TabsTrigger>
              <TabsTrigger value="destinations">Destinations</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="definitions">
            <DefinitionConsole />
          </TabsContent>
          <TabsContent value="facilities">
            <FacilityReviewConsole />
          </TabsContent>
          <TabsContent value="destinations">
            <DestinationConsole />
          </TabsContent>
        </Tabs>
        <aside className="grid min-w-0 items-start gap-4 xl:grid-cols-2 [&>section]:rounded-panel [&>section]:bg-card [&>section]:p-6">
          <CollectionReassignment />
          <ApartmentRoutes />
        </aside>
      </div>
    </div>
  );
}
