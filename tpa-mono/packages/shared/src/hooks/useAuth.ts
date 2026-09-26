import { useState, useEffect, useCallback } from 'preact/hooks';
import { getSupabase, signIn, signOut as authSignOut } from '../db/supabase';
import type { User, AuthState, UserRole } from '../types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const DEMO_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  name: 'Administrator',
  email: 'admin@tpa.demo',
  role: 'admin',
  is_active: true,
  settings: {},
};

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    if (DEMO_MODE) {
      setState({ user: DEMO_USER, isAuthenticated: true, isLoading: false, error: null });
      return;
    }

    const supabase = getSupabase();

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();

        setState({
          user: data as User,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setState({ ...initialState, isLoading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();

          setState({
            user: data as User,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({ ...initialState, isLoading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      setState({ user: DEMO_USER, isAuthenticated: true, isLoading: false, error: null });
      return;
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await signIn(email, password);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Login gagal',
      }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (DEMO_MODE) {
      setState({ user: DEMO_USER, isAuthenticated: true, isLoading: false, error: null });
      return;
    }
    await authSignOut();
    setState({ ...initialState, isLoading: false });
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.role === role;
  }, [state.user]);

  return { ...state, login, logout, hasRole };
}
