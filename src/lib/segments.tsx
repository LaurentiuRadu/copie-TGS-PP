/**
 * Segment utilities for time tracking
 * Centralized segment type definitions, icons, labels, and colors
 */

import React from 'react';
import { Moon, Sun, Calendar, MapPin, Car, Activity, Settings, Users, PartyPopper, ClipboardList } from 'lucide-react';

export type SegmentType = 
  | 'hours_regular' 
  | 'hours_night' 
  | 'hours_saturday' 
  | 'hours_sunday' 
  | 'hours_holiday'
  | 'hours_passenger'
  | 'hours_driving'
  | 'hours_equipment';

export const SEGMENT_TYPES: SegmentType[] = [
  'hours_regular',
  'hours_night',
  'hours_saturday',
  'hours_sunday',
  'hours_holiday',
  'hours_passenger',
  'hours_driving',
  'hours_equipment',
];

/**
 * Get icon component for segment type
 */
export const getSegmentIcon = (type: string): React.ReactElement => {
  switch (type) {
    case 'hours_regular':
      return <Settings className="h-3.5 w-3.5" />;
    case 'hours_night':
      return <Moon className="h-3.5 w-3.5" />;
    case 'hours_saturday':
    case 'hours_sunday':
      return <Calendar className="h-3.5 w-3.5" />;
    case 'hours_holiday':
      return <PartyPopper className="h-3.5 w-3.5" />;
    case 'hours_passenger':
      return <Users className="h-3.5 w-3.5" />;
    case 'hours_driving':
      return <Car className="h-3.5 w-3.5" />;
    case 'hours_equipment':
      return <Settings className="h-3.5 w-3.5" />;
    default:
      return <ClipboardList className="h-3.5 w-3.5" />;
  }
};

/**
 * Get Romanian label for segment type
 */
export const getSegmentLabel = (type: string): string => {
  switch (type) {
    case 'hours_regular':
      return 'Normal';
    case 'hours_night':
      return 'Noapte';
    case 'hours_saturday':
      return 'Sâmbătă';
    case 'hours_sunday':
      return 'Duminică';
    case 'hours_holiday':
      return 'Sărbătoare';
    case 'hours_passenger':
      return 'Pasager';
    case 'hours_driving':
      return 'Condus';
    case 'hours_equipment':
      return 'Utilaj';
    default:
      return type;
  }
};

/**
 * Get Tailwind color classes for segment type
 */
export const getSegmentColors = (type: string): string => {
  const colorMap: Record<string, string> = {
    hours_regular: 'bg-slate-900 dark:bg-slate-700 text-white border-slate-700 dark:border-slate-600',
    hours_night: 'bg-purple-600 dark:bg-purple-700 text-white border-purple-500 dark:border-purple-600',
    hours_saturday: 'bg-blue-500 dark:bg-blue-600 text-white border-blue-400 dark:border-blue-500',
    hours_sunday: 'bg-red-500 dark:bg-red-600 text-white border-red-400 dark:border-red-500',
    hours_holiday: 'bg-pink-500 dark:bg-pink-600 text-white border-pink-400 dark:border-pink-500',
    hours_passenger: 'bg-teal-500 dark:bg-teal-600 text-white border-teal-400 dark:border-teal-500',
    hours_driving: 'bg-orange-500 dark:bg-orange-600 text-white border-orange-400 dark:border-orange-500',
    hours_equipment: 'bg-amber-500 dark:bg-amber-600 text-white border-amber-400 dark:border-amber-500',
  };
  
  return colorMap[type] || 'bg-gray-500 text-white border-gray-400';
};

/**
 * Check if segment type represents driving/equipment work
 */
export const isDriverSegment = (type: string): boolean => {
  return type === 'hours_driving' || type === 'hours_equipment';
};
