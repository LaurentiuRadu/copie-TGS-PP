import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ShiftTypeBadgeProps {
  type: "condus" | "pasager" | "utilaj" | "condus utilaj" | "normal";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ShiftTypeBadge = ({ type, size = "md", className }: ShiftTypeBadgeProps) => {
  const normalizedType = type.toLowerCase();
  
  const colorMap: Record<string, string> = {
    "condus": "bg-shift-driving text-white",
    "pasager": "bg-shift-passenger text-white",
    "utilaj": "bg-shift-equipment text-white",
    "condus utilaj": "bg-shift-equipment text-white",
    "normal": "bg-shift-normal text-white",
  };
  
  const labelMap: Record<string, string> = {
    "condus": "Condus",
    "pasager": "Pasager",
    "utilaj": "Utilaj",
    "condus utilaj": "Condus Utilaj",
    "normal": "Normal",
  };
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };
  
  return (
    <Badge 
      className={cn(
        colorMap[normalizedType] || "bg-muted text-muted-foreground",
        sizeClasses[size],
        className
      )}
    >
      {labelMap[normalizedType] || type}
    </Badge>
  );
};
