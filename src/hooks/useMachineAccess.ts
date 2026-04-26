'use client';

import { useMemo } from 'react';
import type { Station, UserProfile } from '@/lib/types';

export function canAccessMachine(
  station: Station | null,
  userProfile: UserProfile | null,
): boolean {
  if (!station || !userProfile) return false;

  // Admins and managers can access all stations
  if (userProfile.role === 'admin' || userProfile.role === 'manager') {
    return true;
  }

  const userLocationIds = userProfile.locationIds ?? [];

  // If no locations assigned, can access
  if (userLocationIds.length === 0) {
    return true;
  }

  // Operators can only access stations in their assigned locations
  if (station.locationId) {
    return userLocationIds.includes(station.locationId);
  }

  // Stations without locationId are accessible to anyone
  return true;
}

/**
 * Hook to validate and filter stations that the user has access to
 * based on their role and assigned locations
 */
export function useAccessibleMachines(
  stations: Station[],
  userProfile: UserProfile | null,
): {
  accessible: Station[];
  forbidden: Station[];
  canAccessAll: boolean;
} {
  return useMemo(() => {
    if (!userProfile) {
      return { accessible: [], forbidden: stations, canAccessAll: false };
    }

    // Admins and managers can see all stations
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return { accessible: stations, forbidden: [], canAccessAll: true };
    }

    // Operators can only see stations in their assigned locations
    const userLocationIds = userProfile.locationIds ?? [];

    if (userLocationIds.length === 0) {
      // If no locations assigned, can see all
      return { accessible: stations, forbidden: [], canAccessAll: true };
    }

    const accessible: Station[] = [];
    const forbidden: Station[] = [];

    stations.forEach((station) => {
      if (station.locationId && userLocationIds.includes(station.locationId)) {
        accessible.push(station);
      } else if (station.locationId) {
        forbidden.push(station);
      } else {
        // Stations without locationId are accessible to anyone
        accessible.push(station);
      }
    });

    return {
      accessible,
      forbidden,
      canAccessAll: false,
    };
  }, [stations, userProfile]);
}

/**
 * Hook to check if user can access a specific station
 */
export function useCanAccessMachine(
  station: Station | null,
  userProfile: UserProfile | null,
): boolean {
  return useMemo(() => canAccessMachine(station, userProfile), [station, userProfile]);
}
