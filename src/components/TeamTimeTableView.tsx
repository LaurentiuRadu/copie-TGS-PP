import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Check, Edit2, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useInlineTimeEdit } from "@/hooks/useInlineTimeEdit";
import type { TimeEntryForApproval } from "@/hooks/useTeamApprovalWorkflow";

interface TeamTimeTableViewProps {
  entries: TimeEntryForApproval[];
  teamStats: {
    avgClockIn: string | null;
    avgClockOut: string | null;
  };
  onApprove: (entryId: string) => void;
  onEdit: (entry: TimeEntryForApproval) => void;
  onDelete: (entry: TimeEntryForApproval) => void;
  onBulkApprove: (entryIds: string[]) => void;
  isApprovingBatch: boolean;
  detectDiscrepancies: (entry: TimeEntryForApproval) => any;
}

export function TeamTimeTableView({
  entries,
  teamStats,
  onApprove,
  onEdit,
  onDelete,
  onBulkApprove,
  isApprovingBatch,
  detectDiscrepancies,
}: TeamTimeTableViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showOnlyDiscrepancies, setShowOnlyDiscrepancies] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  const {
    editingCell,
    tempValue,
    startEdit,
    handleInputChange,
    handleSave,
    handleCancel,
    isSaving,
  } = useInlineTimeEdit();

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (showOnlyPending && entry.approval_status !== 'pending_review') {
        return false;
      }
      if (showOnlyDiscrepancies) {
        const discrepancy = detectDiscrepancies(entry);
        return discrepancy !== null;
      }
      return true;
    });
  }, [entries, showOnlyPending, showOnlyDiscrepancies, detectDiscrepancies]);

  // Group by employee
  const groupedByEmployee = useMemo(() => {
    const groups = new Map<string, TimeEntryForApproval[]>();
    filteredEntries.forEach(entry => {
      const key = entry.user_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    });
    
    // Convert to array and sort by full_name
    return Array.from(groups.entries())
      .map(([userId, entries]) => ({
        userId,
        profile: entries[0].profiles,
        entries: entries.sort((a, b) => 
          new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime()
        ),
      }))
      .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
  }, [filteredEntries]);

  const toggleRow = (entryId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const toggleSelect = (entryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const getDiscrepancyColor = (entry: TimeEntryForApproval) => {
    const discrepancy = detectDiscrepancies(entry);
    if (!discrepancy) return "";
    
    switch (discrepancy.severity) {
      case "critical":
        return "bg-red-100 dark:bg-red-950/20";
      case "high":
        return "bg-orange-100 dark:bg-orange-950/20";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-950/20";
      default:
        return "";
    }
  };

  const getDiscrepancyBadge = (entry: TimeEntryForApproval) => {
    const discrepancy = detectDiscrepancies(entry);
    if (!discrepancy) return null;

    const colors = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
    };

    return (
      <Badge variant="outline" className={cn("ml-2", colors[discrepancy.severity as keyof typeof colors])}>
        {discrepancy.severity === "critical" ? "🔴" : discrepancy.severity === "high" ? "⚠️" : "⚠"}
      </Badge>
    );
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "HH:mm");
  };

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case "passenger": return "🚙";
      case "driving": return "🚗";
      case "equipment": return "⚙️";
      case "night": return "🌙";
      case "saturday": return "📅";
      case "sunday": return "🗓️";
      case "holiday": return "🎉";
      default: return "⏰";
    }
  };

  const getSegmentLabel = (type: string) => {
    switch (type) {
      case "passenger": return "Pasager";
      case "driving": return "Condus";
      case "equipment": return "Echipament";
      case "night": return "Noapte";
      case "saturday": return "Sâmbătă";
      case "sunday": return "Duminică";
      case "holiday": return "Sărbătoare";
      default: return "Normal";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: Stats + Filters + Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-4">
          {teamStats.avgClockIn && (
            <div>
              <p className="text-xs text-muted-foreground">Media Clock In</p>
              <p className="text-sm font-semibold">{teamStats.avgClockIn}</p>
            </div>
          )}
          {teamStats.avgClockOut && (
            <div>
              <p className="text-xs text-muted-foreground">Media Clock Out</p>
              <p className="text-sm font-semibold">{teamStats.avgClockOut}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Total Angajați</p>
            <p className="text-sm font-semibold">{groupedByEmployee.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={showOnlyPending ? "bg-primary text-primary-foreground" : ""}
          >
            {showOnlyPending ? "Doar Pending" : "Toate"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyDiscrepancies(!showOnlyDiscrepancies)}
            className={showOnlyDiscrepancies ? "bg-orange-500 text-white" : ""}
          >
            {showOnlyDiscrepancies ? "Doar Discrepanțe" : "Toate"}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={() => onBulkApprove(Array.from(selectedIds))}
              disabled={isApprovingBatch}
            >
              <Check className="h-4 w-4 mr-1" />
              Aprobă Selectate ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Angajat</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedByEmployee.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {showOnlyDiscrepancies ? "Nu există discrepanțe" : "Nu există pontaje"}
                </TableCell>
              </TableRow>
            ) : (
              groupedByEmployee.map(({ userId, profile, entries: userEntries }) =>
                userEntries.map((entry, idx) => {
                  const isExpanded = expandedRows.has(entry.id);
                  const isEditing = editingCell?.rowId === entry.id;
                  const discrepancy = detectDiscrepancies(entry);

                  return (
                    <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => toggleRow(entry.id)}>
                      <TableRow className={cn(getDiscrepancyColor(entry))}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={() => toggleSelect(entry.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{profile.full_name}</div>
                          <div className="text-xs text-muted-foreground">@{profile.username}</div>
                          {userEntries.length > 1 && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Pontaj #{entry.pontajNumber || idx + 1}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && editingCell.field === "clockIn" ? (
                            <Input
                              type="time"
                              value={tempValue}
                              onChange={(e) => handleInputChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave(entry.id, "clockIn", entry);
                                if (e.key === "Escape") handleCancel();
                              }}
                              onBlur={() => handleSave(entry.id, "clockIn", entry)}
                              autoFocus
                              className="w-24 h-8"
                              disabled={isSaving}
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-mono h-8 px-2"
                              onClick={() => startEdit(entry.id, "clockIn", formatTime(entry.clock_in_time))}
                            >
                              {formatTime(entry.clock_in_time)}
                            </Button>
                          )}
                          {discrepancy?.discrepancy_type === "late_arrival" && getDiscrepancyBadge(entry)}
                        </TableCell>
                        <TableCell>
                          {isEditing && editingCell.field === "clockOut" ? (
                            <Input
                              type="time"
                              value={tempValue}
                              onChange={(e) => handleInputChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave(entry.id, "clockOut", entry);
                                if (e.key === "Escape") handleCancel();
                              }}
                              onBlur={() => handleSave(entry.id, "clockOut", entry)}
                              autoFocus
                              className="w-24 h-8"
                              disabled={isSaving}
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-mono h-8 px-2"
                              onClick={() => startEdit(entry.id, "clockOut", formatTime(entry.clock_out_time))}
                            >
                              {formatTime(entry.clock_out_time)}
                            </Button>
                          )}
                          {discrepancy?.discrepancy_type === "early_departure" && getDiscrepancyBadge(entry)}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {entry.calculated_hours?.total.toFixed(2) || "0.00"}h
                          </span>
                        </TableCell>
                        <TableCell>
                          {entry.approval_status === "approved" ? (
                            <Badge variant="default" className="bg-green-600">
                              ✓ Aprobat
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {entry.approval_status === "pending_review" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onApprove(entry.id)}
                                className="h-8 px-2"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit(entry)}
                              className="h-8 px-2"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(entry)}
                              className="h-8 px-2 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expandable: Segments */}
                      {entry.segments && entry.segments.length > 0 && (
                        <CollapsibleContent asChild>
                          <TableRow className={cn(getDiscrepancyColor(entry), "bg-muted/5")}>
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-muted-foreground">
                                  Segmente de timp ({entry.segments.length}):
                                </p>
                                <div className="grid gap-2">
                                  {entry.segments.map((segment) => (
                                    <div
                                      key={segment.id}
                                      className="flex items-center justify-between p-2 bg-card rounded border text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{getSegmentIcon(segment.segment_type)}</span>
                                        <span className="font-medium">{getSegmentLabel(segment.segment_type)}</span>
                                      </div>
                                      <div className="flex items-center gap-4 font-mono text-xs">
                                        <span>{formatTime(segment.start_time)}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <span>{formatTime(segment.end_time)}</span>
                                        <Badge variant="outline" className="ml-2">
                                          {segment.hours_decimal.toFixed(2)}h
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  );
                })
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
