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
        <h1 className="font-display text-2xl font-semibold">
          Material and facility review
        </h1>
        <p className="text-sm text-muted-foreground">
          Review definitions and supplied compliance evidence. Keep regulatory
          permission separate from commercial listings.
        </p>
      </div>
      <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
        <Tabs defaultValue="definitions" className="min-w-0">
          <TabsList>
            <TabsTrigger value="definitions">Material definitions</TabsTrigger>
            <TabsTrigger value="facilities">Facility scope</TabsTrigger>
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
          </TabsList>
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
        <aside className="min-w-0 space-y-4">
          <CollectionReassignment />
          <ApartmentRoutes />
        </aside>
      </div>
    </div>
  );
}
