"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CollectionReassignment } from "./collection-reassignment";
import {
  DestinationConsole,
  FacilityReviewConsole,
} from "./compliance-console";
import { DefinitionConsole } from "./definition-console";
export function OperationsConsole() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b pb-5">
        <h1 className="font-display text-2xl font-semibold">
          Material and facility review
        </h1>
        <p className="text-sm text-muted-foreground">
          Review definitions and supplied compliance evidence. Keep regulatory
          permission separate from commercial listings.
        </p>
      </div>
      <Tabs defaultValue="definitions">
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
      <CollectionReassignment />
    </div>
  );
}
