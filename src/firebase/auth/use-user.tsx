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
import { doc, onSnapshot } from 'firebase/firestore';

import { useAuth as useFirebaseAuth, useFirestore } from '../provider';

import type { UserProfile } from '@/lib/types';


export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  const firestore = useFirestore();

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const unsubProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUserProfile({ uid: doc.id, ...doc.data() } as UserProfile);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  const logout = async () => {
    await signOut(auth);
  };

  const value = { user, userProfile, loading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
