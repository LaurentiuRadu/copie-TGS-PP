import React from 'react';
import { MobileTableCard, MobileTableRow } from '@/components/MobileTableCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle2, Plus, Clock, Car, AlertCircle } from 'lucide-react';
import { formatRomania } from '@/lib/timezone';
import { getSegmentIcon, getSegmentLabel } from '@/lib/segments';
import { EmployeeDayData } from '@/types/timeApproval';

interface EmployeeCardProps {
  employee: EmployeeDayData;
  teamAverage: {
    clockIn: string;
    clockOut: string;
    totalHours: number;
  };
  isDriver: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onAddManualEntry: () => void;
  onClockInEdit?: () => void;
  onClockOutEdit?: () => void;
  onSegmentClick?: (segmentType: string, hours: number) => void;
  isAdmin: boolean;
}

const getDiscrepancyColor = (actualTime: string, averageTime: string, threshold: number = 30): string => {
  if (!actualTime || !averageTime) return 'text-foreground';
  
  const [actualH, actualM] = actualTime.split(':').map(Number);
  const [avgH, avgM] = averageTime.split(':').map(Number);
  
  const actualMinutes = actualH * 60 + actualM;
  const avgMinutes = avgH * 60 + avgM;
  const diffMinutes = Math.abs(actualMinutes - avgMinutes);
  
  if (diffMinutes > threshold) return 'text-destructive font-bold';
  if (diffMinutes > 15) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-foreground';
};

export const EmployeeCard = React.memo(({ 
  employee, 
  teamAverage,
  isDriver,
  onEdit,
  onDelete,
  onApprove,
  onAddManualEntry,
  onClockInEdit,
  onClockOutEdit,
  onSegmentClick,
  isAdmin
}: EmployeeCardProps) => {
  // Status badge
  const getStatusBadge = () => {
    if (employee.isMissing) {
      return <Badge variant="destructive" className="text-xs">NU S-A PONTAJAT</Badge>;
    }
    if (employee.allApproved) {
      return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">Aprobat</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Neaprobat</Badge>;
  };

  const clockInTime = employee.firstClockIn ? formatRomania(new Date(employee.firstClockIn), 'HH:mm') : '-';
  const clockOutTime = employee.lastClockOut ? formatRomania(new Date(employee.lastClockOut), 'HH:mm') : '-';

  return (
    <MobileTableCard>
      {/* Header: Name + Status */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{employee.fullName}</h3>
            {isDriver && <Car className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">{employee.username}</p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Clock Times */}
      <MobileTableRow 
        label="Pontaj Intrare"
        value={
          <div className="flex items-center gap-2">
            <span className={getDiscrepancyColor(clockInTime, teamAverage.clockIn)}>
              {clockInTime}
            </span>
            {onClockInEdit && isAdmin && !employee.isMissing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClockInEdit}
                className="h-6 w-6 p-0"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        }
      />

      <MobileTableRow 
        label="Pontaj Ieșire"
        value={
          <div className="flex items-center gap-2">
            <span className={getDiscrepancyColor(clockOutTime, teamAverage.clockOut)}>
              {clockOutTime}
            </span>
            {onClockOutEdit && isAdmin && employee.lastClockOut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClockOutEdit}
                className="h-6 w-6 p-0"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        }
      />

      {/* Segments - Horizontal Scroll */}
      <div className="py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground mb-2">Segmente Timp</p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {employee.segments.map((segment) => (
            <Badge 
              key={segment.id}
              variant="outline"
              className="flex-shrink-0 gap-1.5 cursor-pointer hover:bg-accent/50 min-w-fit touch-target"
              onClick={() => onSegmentClick?.(segment.type, segment.duration)}
            >
              {getSegmentIcon(segment.type)}
              <span className="text-xs">{getSegmentLabel(segment.type)}</span>
              <span className="text-xs font-semibold">{segment.duration.toFixed(2)}h</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Total Hours */}
      <MobileTableRow 
        label="Total Ore"
        value={
          <span className={`font-bold text-base ${
            Math.abs(employee.totalHours - teamAverage.totalHours) > 0.5 
              ? 'text-destructive' 
              : 'text-foreground'
          }`}>
            {employee.totalHours.toFixed(2)}h
          </span>
        }
      />

      {/* Manual Override Info */}
      {employee.manualOverride && (
        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Ore editate manual (override)</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
        {!employee.isMissing && !employee.allApproved && employee.entries.length > 0 && (
          <Button
            onClick={onApprove}
            size="sm"
            variant="default"
            className="flex-1 min-w-[120px] touch-target"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Aprobă
          </Button>
        )}
        
        {!employee.isMissing && employee.entries.length > 0 && (
          <>
            <Button
              onClick={onEdit}
              size="sm"
              variant="outline"
              className="flex-1 min-w-[100px] touch-target"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Editează
            </Button>
            <Button
              onClick={onDelete}
              size="sm"
              variant="destructive"
              className="flex-1 min-w-[100px] touch-target"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Șterge
            </Button>
          </>
        )}

        {employee.isMissing && (
          <Button
            onClick={onAddManualEntry}
            size="sm"
            variant="default"
            className="flex-1 touch-target"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adaugă Pontaj Manual
          </Button>
        )}
      </div>

      {/* Schedule Info (if available) */}
      {(employee.scheduled_shift || employee.scheduled_location) && (
        <div className="mt-3 p-2 bg-muted/30 rounded-md text-xs space-y-1">
          {employee.scheduled_shift && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>Tură: {employee.scheduled_shift}</span>
            </div>
          )}
          {employee.scheduled_location && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              <span>Locație: {employee.scheduled_location}</span>
            </div>
          )}
        </div>
      )}
    </MobileTableCard>
  );
}, (prevProps, nextProps) => {
  // Custom comparator for performance
  return (
    prevProps.employee.userId === nextProps.employee.userId &&
    prevProps.employee.totalHours === nextProps.employee.totalHours &&
    prevProps.employee.firstClockIn === nextProps.employee.firstClockIn &&
    prevProps.employee.lastClockOut === nextProps.employee.lastClockOut &&
    prevProps.employee.allApproved === nextProps.employee.allApproved &&
    prevProps.employee.manualOverride === nextProps.employee.manualOverride &&
    prevProps.teamAverage.totalHours === nextProps.teamAverage.totalHours
  );
});

EmployeeCard.displayName = 'EmployeeCard';
