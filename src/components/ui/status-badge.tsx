import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "approved" | "pending" | "rejected" | "edited" | "verified" | "draft" | "active" | "inactive";

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StatusBadge = ({ status, size = "md", className }: StatusBadgeProps) => {
  const config: Record<StatusType, { label: string; className: string }> = {
    approved: { label: "Aprobat", className: "bg-success text-success-foreground" },
    pending: { label: "În așteptare", className: "bg-warning text-warning-foreground" },
    rejected: { label: "Respins", className: "bg-destructive text-destructive-foreground" },
    edited: { label: "Editat", className: "bg-info text-info-foreground" },
    verified: { label: "Verificat", className: "bg-success/70 text-success-foreground" },
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    active: { label: "Activ", className: "bg-success text-success-foreground" },
    inactive: { label: "Inactiv", className: "bg-muted text-muted-foreground" },
  };
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };
  
  const { label, className: statusClassName } = config[status] || config.draft;
  
  return (
    <Badge 
      className={cn(
        statusClassName,
        sizeClasses[size],
        className
      )}
    >
      {label}
    </Badge>
  );
};
