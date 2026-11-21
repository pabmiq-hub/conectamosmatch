import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function FeaturedSolutionStar({ name, featured, busy, onToggle }: {
  name: string; featured: boolean; busy: boolean; onToggle: () => void;
}) {
  const label = `${featured ? "Dejar de destacar" : "Destacar"} ${name} en este evento`;
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <Button type="button" variant="ghost" size="icon" aria-label={label} aria-pressed={featured}
        disabled={busy} className={featured ? "text-featured hover:text-featured" : "text-muted-foreground"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>
        <Star className={featured ? "fill-current" : ""} />
      </Button>
    </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>
  );
}