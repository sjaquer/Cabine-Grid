'use client';

import { useMemo } from 'react';
import type { Machine, UserProfile } from '@/lib/types';

export function canAccessMachine(
  machine: Machine | null,
  userProfile: UserProfile | null,
): boolean {
  if (!machine || !userProfile) return false;

  // Admins and managers can access all machines
  if (userProfile.role === 'admin' || userProfile.role === 'manager') {
    return true;
  }

  const userLocationIds = userProfile.locationIds ?? [];

  // If no locations assigned, can access
  if (userLocationIds.length === 0) {
    return true;
  }

  // Operators can only access machines in their assigned locations
  if (machine.locationId) {
    return userLocationIds.includes(machine.locationId);
  }

  // Machines without locationId are accessible to anyone
  return true;
}

/**
 * Hook to validate and filter machines that the user has access to
 * based on their role and assigned locations
 */
export function useAccessibleMachines(
  machines: Machine[],
  userProfile: UserProfile | null,
): {
  accessible: Machine[];
  forbidden: Machine[];
  canAccessAll: boolean;
} {
  return useMemo(() => {
    if (!userProfile) {
      return { accessible: [], forbidden: machines, canAccessAll: false };
    }

    // Admins and managers can see all machines
    if (userProfile.role === 'admin' || userProfile.role === 'manager') {
      return { accessible: machines, forbidden: [], canAccessAll: true };
    }

    // Operators can only see machines in their assigned locations
    const userLocationIds = userProfile.locationIds ?? [];

    if (userLocationIds.length === 0) {
      // If no locations assigned, can see all
      return { accessible: machines, forbidden: [], canAccessAll: true };
    }

    const accessible: Machine[] = [];
    const forbidden: Machine[] = [];

    machines.forEach((machine) => {
      if (machine.locationId && userLocationIds.includes(machine.locationId)) {
        accessible.push(machine);
      } else if (machine.locationId) {
        forbidden.push(machine);
      } else {
        // Machines without locationId are accessible to anyone
        accessible.push(machine);
      }
    });

    return {
      accessible,
      forbidden,
      canAccessAll: false,
    };
  }, [machines, userProfile]);
}

/**
 * Hook to check if user can access a specific machine
 */
export function useCanAccessMachine(
  machine: Machine | null,
  userProfile: UserProfile | null,
): boolean {
  return useMemo(() => canAccessMachine(machine, userProfile), [machine, userProfile]);
}
