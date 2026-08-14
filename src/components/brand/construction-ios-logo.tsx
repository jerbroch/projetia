import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConstructionIosLogoProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4", text: "text-sm" },
  md: { box: "h-12 w-12", icon: "h-6 w-6", text: "text-lg" },
  lg: { box: "h-16 w-16", icon: "h-8 w-8", text: "text-xl" },
} as const;

export function ConstructionIosLogo({
  size = "md",
  showName = true,
  className,
}: ConstructionIosLogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
          config.box
        )}
      >
        <HardHat className={config.icon} />
      </div>
      {showName && (
        <span className={cn("font-bold tracking-tight text-foreground", config.text)}>
          Construction iOS
        </span>
      )}
    </div>
  );
}
