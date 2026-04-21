import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Returns the current user's role and some derived booleans.
 * Roles: 'salesperson' | 'sales_admin' | 'manager' | 'admin' | 'porter'
 */
export function useUserRole() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user?.id) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, home_region')
        .eq('id', user.id)
        .single();

      if (!mounted) return;
      if (error) {
        console.error('useUserRole error:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const role = profile?.role ?? 'salesperson';

  return {
    profile,
    role,
    loading,
    isAdmin:        role === 'admin',
    isManager:      role === 'manager' || role === 'admin',
    isSalesAdmin:   role === 'sales_admin' || role === 'manager' || role === 'admin',
    isSalesperson:  role === 'salesperson',
    isPorter:       role === 'porter',
  };
}
