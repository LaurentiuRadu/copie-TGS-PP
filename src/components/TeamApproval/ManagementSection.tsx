/**
 * ManagementSection Component
 * Displays and manages time entries for coordinators and team leaders
 * Extracted from TeamTimeApprovalManager for better code organization
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Pencil,
  Check,
  X,
  Plus,
  ChevronDown,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatRomania } from '@/lib/timezone';
import { getSegmentIcon, getSegmentLabel, SEGMENT_TYPES } from '@/lib/segments';
import type { ManagementUser, EmployeeDayData } from '@/types/timeApproval';

interface ManagementSectionProps {
  managementGroupedByUser: ManagementUser[];
  teamLeaderId?: string;
  isAdmin: boolean;
  editingManagementHours: {
    userId: string | null;
    segmentType: string | null;
    value: string;
  };
  onSetEditingManagementHours: (state: {
    userId: string | null;
    segmentType: string | null;
    value: string;
  }) => void;
  onSaveManagementSegmentHours: (userId: string, segmentType: string, hours: number) => void;
  onClockTimeClick: (employee: EmployeeDayData, fieldName: 'Clock In' | 'Clock Out') => void;
  onApprove: (entryId: string) => void;
  onAddManualEntry: (employee: EmployeeDayData) => void;
  selectedWeek: string;
  selectedDayOfWeek: number;
  selectedTeam: string | null;
  managementEntries: any[];
}

export const ManagementSection = React.memo(({
  managementGroupedByUser,
  teamLeaderId,
  isAdmin,
  editingManagementHours,
  onSetEditingManagementHours,
  onSaveManagementSegmentHours,
  onClockTimeClick,
  onApprove,
  onAddManualEntry,
  selectedWeek,
  selectedDayOfWeek,
  selectedTeam,
  managementEntries,
}: ManagementSectionProps) => {
  const standardTypes = SEGMENT_TYPES;

  const getDisplayHoursMgmt = (user: ManagementUser, type: string): number => {
    if (user.manualOverride && user.overrideHours) {
      return user.overrideHours[type] || 0;
    }
    return user.segmentsByType[type] || 0;
  };

  return (
    <Collapsible className="mb-6">
      <Card className="border-2 border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Badge variant="default" className="bg-primary text-primary-foreground">
                    👔 Supervizori și Coordonatori
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-lg">Pontaje Supervizori și Coordonatori</CardTitle>
                  <CardDescription>
                    {managementGroupedByUser.length}{' '}
                    {managementGroupedByUser.length === 1 ? 'pontaj' : 'pontaje'}
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {managementGroupedByUser.map((user) => {
                const isTeamLeader = user.userId === teamLeaderId;
                const isApproved = user.approvalStatus === 'approved';

                return (
                  <div
                    key={user.userId}
                    className={`p-4 rounded-lg border ${
                      user.isMissing
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                        : isApproved
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={isTeamLeader ? 'default' : 'secondary'}
                            className={isTeamLeader ? 'bg-blue-600' : 'bg-purple-600'}
                          >
                            {isTeamLeader ? '👔 Șef Echipă' : '👑 Coordonator'}
                          </Badge>
                          <span className="font-semibold">{user.fullName}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.username}
                          </Badge>
                          {isApproved && (
                            <Badge variant="default" className="bg-green-600 text-white gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Aprobat
                            </Badge>
                          )}
                          {user.manualOverride && (
                            <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                              ✋ Manual
                            </Badge>
                          )}
                        </div>

                        {user.isMissing ? (
                          (() => {
                            const weekStart = new Date(selectedWeek);
                            const dayDate = new Date(weekStart);
                            dayDate.setDate(dayDate.getDate() + (selectedDayOfWeek - 1));
                            const isFutureDate = dayDate > new Date();

                            return (
                              <div
                                className={`p-4 rounded-lg border ${
                                  isFutureDate
                                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {isFutureDate ? (
                                    <>
                                      <Calendar className="h-5 w-5 text-blue-500" />
                                      <p className="text-blue-600 dark:text-blue-400 font-medium">
                                        Programat - fără pontaj înregistrat încă
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="h-5 w-5 text-red-500" />
                                      <p className="text-red-600 dark:text-red-400 font-medium">
                                        Lipsă complet - nu s-a pontajat
                                      </p>
                                    </>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    const employeeData: EmployeeDayData = {
                                      userId: user.userId,
                                      fullName: user.fullName,
                                      username: user.username,
                                      totalHours: 0,
                                      firstClockIn: '',
                                      lastClockOut: null,
                                      segments: [],
                                      entries: [],
                                      allApproved: false,
                                      isMissing: true,
                                      teamId: selectedTeam || undefined,
                                      dayOfWeek: selectedDayOfWeek,
                                    };
                                    onAddManualEntry(employeeData);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {isFutureDate ? 'Adaugă Pontaj Manual' : 'Adaugă Pontaj Lipsă'}
                                </Button>
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                                <button
                                  onClick={() => {
                                    const managementEntry = managementEntries.find(
                                      (e) => e.user_id === user.userId
                                    );
                                    if (managementEntry) {
                                      const employeeData: EmployeeDayData = {
                                        userId: user.userId,
                                        fullName: user.fullName,
                                        username: user.username,
                                        totalHours: user.totalHours,
                                        firstClockIn: user.firstClockIn,
                                        lastClockOut: user.lastClockOut,
                                        segments:
                                          managementEntry.segments?.map((s: any) => ({
                                            id: s.id,
                                            type: s.segment_type,
                                            startTime: s.start_time,
                                            endTime: s.end_time,
                                            duration: s.hours_decimal,
                                          })) || [],
                                        entries: managementEntries.filter(
                                          (e) => e.user_id === user.userId
                                        ),
                                        allApproved: user.approvalStatus === 'approved',
                                        manualOverride: user.manualOverride,
                                        overrideHours: user.overrideHours,
                                      };
                                      onClockTimeClick(employeeData, 'Clock In');
                                    }
                                  }}
                                  className="font-mono font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  {formatRomania(user.firstClockIn, 'HH:mm')}
                                  <Pencil className="h-3 w-3 opacity-60" />
                                </button>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                                {isAdmin ? (
                                  <button
                                    onClick={() => {
                                      const managementEntry = managementEntries.find(
                                        (e) => e.user_id === user.userId
                                      );
                                      if (managementEntry) {
                                        const employeeData: EmployeeDayData = {
                                          userId: user.userId,
                                          fullName: user.fullName,
                                          username: user.username,
                                          totalHours: user.totalHours,
                                          firstClockIn: user.firstClockIn,
                                          lastClockOut: user.lastClockOut || '',
                                          segments:
                                            managementEntry.segments?.map((s: any) => ({
                                              id: s.id,
                                              type: s.segment_type,
                                              startTime: s.start_time,
                                              endTime: s.end_time,
                                              duration: s.hours_decimal,
                                            })) || [],
                                          entries: managementEntries.filter(
                                            (e) => e.user_id === user.userId
                                          ),
                                          allApproved: user.approvalStatus === 'approved',
                                          manualOverride: user.manualOverride,
                                          overrideHours: user.overrideHours,
                                        };
                                        onClockTimeClick(employeeData, 'Clock Out');
                                      }
                                    }}
                                    className="font-mono font-semibold hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    {user.lastClockOut ? formatRomania(user.lastClockOut, 'HH:mm') : '—'}
                                    <Pencil className="h-3 w-3 opacity-60" />
                                  </button>
                                ) : (
                                  <span className="font-mono font-semibold">
                                    {user.lastClockOut ? formatRomania(user.lastClockOut, 'HH:mm') : '—'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Total Ore</p>
                                <p className="font-mono font-semibold text-primary">
                                  {user.lastClockOut ? `${user.totalHours.toFixed(2)}h` : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Badge-uri pentru tipuri de ore */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {standardTypes.map((t) => {
                                const val = getDisplayHoursMgmt(user, t);
                                const label = getSegmentLabel(t);
                                const icon = getSegmentIcon(t);
                                const isEditing =
                                  editingManagementHours.userId === user.userId &&
                                  editingManagementHours.segmentType === t;

                                if (!isAdmin) {
                                  if (val <= 0) return null;
                                  return (
                                    <Badge key={t} variant="secondary" className="text-xs gap-1">
                                      {icon}
                                      <span>{label}</span>
                                      <span className="font-mono">{val.toFixed(1)}h</span>
                                    </Badge>
                                  );
                                }

                                if (val <= 0 && !isEditing) {
                                  return (
                                    <Button
                                      key={t}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs gap-1 opacity-60 hover:opacity-100"
                                      onClick={() =>
                                        onSetEditingManagementHours({
                                          userId: user.userId,
                                          segmentType: t,
                                          value: '0.0',
                                        })
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                      {icon}
                                      <span>{label}</span>
                                    </Button>
                                  );
                                }

                                return (
                                  <div key={t} className="inline-flex items-center gap-1">
                                    {!isEditing ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs gap-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                                        onClick={() =>
                                          onSetEditingManagementHours({
                                            userId: user.userId,
                                            segmentType: t,
                                            value: val.toFixed(1),
                                          })
                                        }
                                      >
                                        {icon}
                                        <span>{label}</span>
                                        <span className="font-mono">{val.toFixed(1)}h</span>
                                      </Badge>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          step="0.1"
                                          value={editingManagementHours.value}
                                          onChange={(e) =>
                                            onSetEditingManagementHours({
                                              ...editingManagementHours,
                                              value: e.target.value,
                                            })
                                          }
                                          className="w-16 h-8 text-sm font-mono"
                                          autoFocus
                                          onFocus={(e) => e.target.select()}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              onSaveManagementSegmentHours(
                                                user.userId,
                                                t,
                                                parseFloat(editingManagementHours.value) || 0
                                              );
                                              onSetEditingManagementHours({
                                                userId: null,
                                                segmentType: null,
                                                value: '',
                                              });
                                            } else if (e.key === 'Escape') {
                                              onSetEditingManagementHours({
                                                userId: null,
                                                segmentType: null,
                                                value: '',
                                              });
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                          onClick={() => {
                                            onSaveManagementSegmentHours(
                                              user.userId,
                                              t,
                                              parseFloat(editingManagementHours.value) || 0
                                            );
                                            onSetEditingManagementHours({
                                              userId: null,
                                              segmentType: null,
                                              value: '',
                                            });
                                          }}
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                          onClick={() =>
                                            onSetEditingManagementHours({
                                              userId: null,
                                              segmentType: null,
                                              value: '',
                                            })
                                          }
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!isApproved && !user.isMissing && (
                          <Button
                            onClick={() => {
                              const entry = managementEntries.find((e) => e.user_id === user.userId);
                              if (entry) onApprove(entry.id);
                            }}
                            size="sm"
                            variant="default"
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            Aprobă
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}, (prevProps, nextProps) => {
  // Custom comparator pentru React.memo
  return (
    prevProps.managementGroupedByUser === nextProps.managementGroupedByUser &&
    prevProps.teamLeaderId === nextProps.teamLeaderId &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.editingManagementHours === nextProps.editingManagementHours &&
    prevProps.selectedWeek === nextProps.selectedWeek &&
    prevProps.selectedDayOfWeek === nextProps.selectedDayOfWeek
  );
});

ManagementSection.displayName = 'ManagementSection';
