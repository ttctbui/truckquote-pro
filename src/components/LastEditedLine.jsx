// src/components/LastEditedLine.jsx
//
// Tiny footer line for QuoteDetail showing who touched the quote last
// and when. Renders nothing if the quote has never been edited.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LastEditedLine({ quote }) {
  const [editorName, setEditorName] = useState(null);

  useEffect(() => {
    if (!quote?.last_edited_by) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', quote.last_edited_by)
        .single();
      if (!cancelled && data) setEditorName(data.full_name || data.email);
    })();
    return () => {
      cancelled = true;
    };
  }, [quote?.last_edited_by]);

  if (!quote?.last_edited_at) return null;

  const when = new Date(quote.last_edited_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Last edited {when}
      {editorName ? <> by <span className="font-medium">{editorName}</span></> : null}
    </p>
  );
}
