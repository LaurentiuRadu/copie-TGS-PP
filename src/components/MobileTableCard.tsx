import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface MobileTableCardProps {
  children: ReactNode;
  onClick?: () => void;
}

export function MobileTableCard({ children, onClick }: MobileTableCardProps) {
  return (
    <Card 
      className="mb-3 hover:bg-accent/30 transition-colors cursor-pointer shadow-sm"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface MobileTableRowProps {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export function MobileTableRow({ label, value, fullWidth = false }: MobileTableRowProps) {
  return (
    <div className={`flex ${fullWidth ? 'flex-col' : 'justify-between items-center'} py-2 border-b border-border/50 last:border-0`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className={`${fullWidth ? 'mt-1' : ''} text-sm`}>{value}</div>
    </div>
  );
}
