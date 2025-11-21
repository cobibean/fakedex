import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Pair } from '@/lib/types';

export function usePairs() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const { data, error } = await supabase
          .from('pairs')
          .select('*')
          .order('symbol');
        
        if (error) throw error;
        if (data) setPairs(data);
      } catch (err) {
        console.error("Error fetching pairs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPairs();
  }, []);

  return { pairs, loading };
}

