import type { Machine } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import PCCard from "./PCCard";

type PCGridProps = {
  machines: Machine[];
  onCardAction: (machine: Machine) => void;
  isLoading: boolean;
};

export default function PCGrid({ machines, onCardAction, isLoading }: PCGridProps) {
  if (isLoading) {
    return (
       <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
        {machines.map((machine) => (
          <PCCard
            key={machine.id}
            machine={machine}
            onAction={onCardAction}
          />
        ))}
      </div>
    </div>
  );
}
