import { useState, useEffect, useCallback } from 'preact/hooks';
import { getSupabase, signIn, signOut as authSignOut } from '../db/supabase';
import type { User, AuthState, UserRole } from '../types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
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
    await authSignOut();
    setState({ ...initialState, isLoading: false });
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.role === role;
  }, [state.user]);

  return { ...state, login, logout, hasRole };
}
