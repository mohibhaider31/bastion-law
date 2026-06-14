import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../lib/push';
import type { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role: 'client' | 'lawyer' | 'owner';
  full_name: string;
  email: string;
  phone: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null, user: null, profile: null, loading: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
    if (session) get().loadProfile();
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('id, role, full_name, email, phone').eq('id', user.id).single();
    if (data) { set({ profile: data as Profile }); registerPushToken(data.id); }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) return error.message;
    set({ session: data.session, user: data.user });
    await get().loadProfile();
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
