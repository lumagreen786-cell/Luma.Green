"use client";
import { AppPageHeader } from "@/components/app/page-parts";
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
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <AppPageHeader
        title="Materials, sites and routes"
        lead="Check material definitions and supplied site evidence. Manage collection routes below. Regulatory permission stays separate from commercial listings."
      />
      <div className="grid min-w-0 items-start gap-4">
        <Tabs defaultValue="definitions" className="min-w-0 gap-6">
          <div className="flex min-w-0 border-b border-border pb-4">
            <TabsList className="h-auto max-w-full flex-wrap justify-start gap-2 rounded-xl bg-muted p-1">
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
        <aside className="grid min-w-0 items-start gap-10 border-t border-border pt-8 xl:grid-cols-2">
          <CollectionReassignment />
          <ApartmentRoutes />
        </aside>
      </div>
    </div>
  );
}
