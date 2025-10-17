/**
 * Shared types for time approval workflow
 * Centralized type definitions to avoid duplication
 */

export interface Segment {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  approval_status: 'pending_review' | 'approved' | 'rejected';
  segments?: Segment[];
}

export interface EmployeeDayData {
  userId: string;
  fullName: string;
  username: string;
  totalHours: number;
  firstClockIn: string;
  lastClockOut: string | null;
  segments: Segment[];
  entries: any[];
  allApproved: boolean;
  isMissing?: boolean;
  manualOverride?: boolean;
  overrideHours?: Record<string, number>;
  teamId?: string;
  dayOfWeek?: number;
  scheduled_shift?: string;
  scheduled_location?: string;
  scheduled_activity?: string;
  scheduled_vehicle?: string;
}

export interface ManagementUser {
  userId: string;
  fullName: string;
  username: string;
  totalHours: number;
  firstClockIn: string;
  lastClockOut: string | null;
  approvalStatus: 'pending_review' | 'approved';
  isMissing: boolean;
  manualOverride?: boolean;
  overrideHours?: Record<string, number>;
  segmentsByType: Record<string, number>;
}

export type EditScope = 'employee' | 'all_non_drivers';

export interface EditDialogData {
  open: boolean;
  fieldName: 'Clock In' | 'Clock Out';
  employee: EmployeeDayData;
  currentValue: string;
  newValue: string;
}
