import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Pair } from '@/lib/types';
import { DEFAULT_PAIRS } from '@/lib/mockData';

export function usePairs() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        if (!isSupabaseConfigured || !supabase) {
          setPairs(DEFAULT_PAIRS);
          return;
        }

        const { data, error } = await supabase
          .from('pairs')
          .select('*')
          .order('symbol');
        
        if (error || !data?.length) {
          setPairs(DEFAULT_PAIRS);
          return;
        }

        setPairs(data);
      } catch (err) {
        console.error("Error fetching pairs:", err);
        setPairs(DEFAULT_PAIRS);
      } finally {
        setLoading(false);
      }
    };

    fetchPairs();
  }, []);

  return { pairs, loading };
}

