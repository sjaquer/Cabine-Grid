'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';

import { useFirebaseAuthInstance, useFirestore } from '../provider';
import type { UserProfile } from '@/lib/types';
import { useMemoFirebase } from '../provider';
import { useDoc } from '../firestore/use-doc';

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuthInstance();
  const firestore = useFirestore();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  // Create a memoized reference to the user's profile document
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  // Use the useDoc hook to get the user profile in real-time
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const logout = async () => {
    await signOut(auth);
  };

  const value = { 
    user, 
    userProfile: userProfile as UserProfile | null, 
    loading: loading || isProfileLoading, 
    logout 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
