import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Explore voices" };

export default function VoicesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader title="Explore voices" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No voices to explore yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and preview voices here once this feature is available.
          </p>
        </div>
      </div>
    </div>
  );
}
