import type { Machine } from "@/lib/types";
import PCCard from "./PCCard";

type PCGridProps = {
  machines: Machine[];
  onCardAction: (machine: Machine) => void;
};

export default function PCGrid({ machines, onCardAction }: PCGridProps) {
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
