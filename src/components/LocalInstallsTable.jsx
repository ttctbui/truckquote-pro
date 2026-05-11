// src/components/LocalInstallsTable.jsx
//
// Editable table for vendor add-ons / fees per quote.
// - Dynamic add/remove rows
// - Auto-totals at the bottom
// - Negative values rendered in red (vendor credits, rebates, cost-back)
// - Two modes: 'controlled' (parent owns state, used in NewQuote)
//              and 'persistent' (writes directly to quote_installs, used in QuoteDetail)
//
// In persistent mode, accepts `quoteId` and saves on row blur or row removal.
// In controlled mode, parent passes `installs` and `onChange`.
//
// onChange is fired on EVERY local mutation in BOTH modes so the parent
// (e.g. QuoteDetail) can recalculate its RECAP totals immediately.

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_ROW = {
  description: '',
  vendor: '',
  po_number: '',
  dnp_amount: '',
  markup_amount: '',
  customer_total: '',
};

export default function LocalInstallsTable({
  quoteId,                   // when set → persistent mode
  installs: controlledInstalls,
  onChange: controlledOnChange,
  readOnly = false,
}) {
  const isPersistent = !!quoteId;
  const [internalInstalls, setInternalInstalls] = useState(controlledInstalls || []);
  const [loading, setLoading] = useState(isPersistent);

  // Keep a stable ref to the onChange callback to avoid re-running effects.
  const onChangeRef = useRef(controlledOnChange);
  useEffect(() => { onChangeRef.current = controlledOnChange; }, [controlledOnChange]);

  // Initial load (persistent mode only)
  useEffect(() => {
    if (!isPersistent) {
      setInternalInstalls(controlledInstalls || []);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('quote_installs')
        .select('*')
        .eq('quote_id', quoteId)
        .order('position', { ascending: true, nullsFirst: false });
      if (!cancelled) {
        if (error) console.error('LocalInstalls load error:', error);
        const rows = data || [];
        setInternalInstalls(rows);
        setLoading(false);
        // Notify parent on initial load so RECAP totals are right from the start
        onChangeRef.current?.(rows);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // In controlled mode, sync down when parent changes
  useEffect(() => {
    if (!isPersistent) setInternalInstalls(controlledInstalls || []);
  }, [controlledInstalls, isPersistent]);

  // Single state-update helper. ALWAYS uses functional setState to avoid
  // stale closures, and notifies parent in BOTH modes.
  const mutate = useCallback((updater) => {
    setInternalInstalls((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Fire parent onChange on every local mutation (used by QuoteDetail's RECAP recalc)
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const installs = internalInstalls;

  // --- row mutations ----------------------------------------------------

  const addRow = async () => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRow = {
      ...EMPTY_ROW,
      position: installs.length + 1,
      id: tempId,
      _isNew: true,
    };
    mutate((prev) => [...prev, newRow]);

    if (isPersistent) {
      const { id: _tempId, _isNew, ...payload } = newRow;
      const { data, error } = await supabase
        .from('quote_installs')
        .insert({ ...payload, quote_id: quoteId })
        .select()
        .single();
      if (error) {
        console.error('install insert failed:', error);
        // remove the optimistic row — use functional update to grab latest state
        mutate((prev) => prev.filter((r) => r.id !== tempId));
        return;
      }
      // swap temp id for real id — again, functional update against the latest state
      mutate((prev) => prev.map((r) => (r.id === tempId ? { ...r, ...data } : r)));
    }
  };

  const removeRow = async (rowId) => {
    mutate((prev) => prev.filter((r) => r.id !== rowId));
    if (isPersistent && !String(rowId).startsWith('temp-')) {
      const { error } = await supabase
        .from('quote_installs')
        .delete()
        .eq('id', rowId);
      if (error) console.error('install delete failed:', error);
    }
  };

  const updateField = (rowId, field, value) => {
    mutate((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
  };

  // Save a row to DB on blur (persistent mode only)
  const saveRow = async (rowId) => {
    if (!isPersistent) return;
    if (String(rowId).startsWith('temp-')) return;     // not yet inserted
    // Read the current value from state (not closure)
    const row = internalInstalls.find((r) => r.id === rowId);
    if (!row) return;

    const { error } = await supabase
      .from('quote_installs')
      .update({
        description: row.description || null,
        vendor: row.vendor || null,
        po_number: row.po_number || null,
        dnp_amount: numOrNull(row.dnp_amount),
        markup_amount: numOrNull(row.markup_amount),
        customer_total: numOrNull(row.customer_total),
        position: row.position,
      })
      .eq('id', rowId);
    if (error) console.error('install update failed:', error);
  };

  // --- derived totals ---------------------------------------------------

  const totals = installs.reduce(
    (acc, r) => ({
      dnp: acc.dnp + (parseFloat(r.dnp_amount) || 0),
      markup: acc.markup + (parseFloat(r.markup_amount) || 0),
      customer: acc.customer + (parseFloat(r.customer_total) || 0),
    }),
    { dnp: 0, markup: 0, customer: 0 }
  );

  // --- styles -----------------------------------------------------------

  const inputBase =
    'w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded px-2 py-1 text-sm border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-1 focus:ring-ttc-blue/30';

  const numericInput = (val) => {
    const n = parseFloat(val);
    const isNeg = Number.isFinite(n) && n < 0;
    return `${inputBase} font-numeric text-right ${isNeg ? 'text-stat-red dark:text-red-400' : ''}`;
  };

  const totalClass = (val) => {
    const isNeg = val < 0;
    return `p-2 text-right font-numeric ${
      isNeg
        ? 'text-stat-red dark:text-red-400'
        : 'text-gray-900 dark:text-dark-text'
    }`;
  };

  // --- render -----------------------------------------------------------

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
          Local Installations
        </h3>
        {!readOnly && (
          <button
            onClick={addRow}
            className="text-xs px-2 py-1 rounded-md bg-ttc-blue hover:bg-ttc-blue-dark text-white font-semibold transition-colors"
          >
            + Add Row
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-dark-muted py-4">Loading…</div>
      ) : installs.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-dark-muted italic py-4 text-center bg-gray-50 dark:bg-dark-bg rounded-lg border border-dashed border-gray-300 dark:border-dark-border">
          No local installations yet. Click "+ Add Row" to add one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
              <tr>
                <th className="p-2 text-left w-8">#</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left w-32">Vendor</th>
                <th className="p-2 text-left w-24">P.O. #</th>
                <th className="p-2 text-right w-24">DNP $</th>
                <th className="p-2 text-right w-24">Mark-up</th>
                <th className="p-2 text-right w-28">Customer Total</th>
                {!readOnly && <th className="p-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {installs.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-200 dark:border-dark-border"
                >
                  <td className="p-2 text-gray-500 dark:text-dark-muted font-numeric text-center">
                    {i + 1}
                  </td>
                  <td className="p-2">
                    <input
                      className={inputBase}
                      value={r.description || ''}
                      onChange={(e) => updateField(r.id, 'description', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      placeholder="e.g. Clean truck check fee"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={inputBase}
                      value={r.vendor || ''}
                      onChange={(e) => updateField(r.id, 'vendor', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={inputBase}
                      value={r.po_number || ''}
                      onChange={(e) => updateField(r.id, 'po_number', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={numericInput(r.dnp_amount)}
                      value={r.dnp_amount ?? ''}
                      onChange={(e) => updateField(r.id, 'dnp_amount', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={numericInput(r.markup_amount)}
                      value={r.markup_amount ?? ''}
                      onChange={(e) => updateField(r.id, 'markup_amount', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={numericInput(r.customer_total)}
                      value={r.customer_total ?? ''}
                      onChange={(e) => updateField(r.id, 'customer_total', e.target.value)}
                      onBlur={() => saveRow(r.id)}
                      placeholder="0.00"
                      disabled={readOnly}
                    />
                  </td>
                  {!readOnly && (
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removeRow(r.id)}
                        className="text-gray-400 hover:text-red-600 dark:text-dark-muted dark:hover:text-red-400 text-lg leading-none"
                        title="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-dark-bg font-semibold">
              <tr className="border-t-2 border-gray-300 dark:border-dark-border">
                <td colSpan={4} className="p-2 text-right text-gray-600 dark:text-dark-muted text-xs uppercase tracking-wider">
                  Totals
                </td>
                <td className={totalClass(totals.dnp)}>{fmt(totals.dnp)}</td>
                <td className={totalClass(totals.markup)}>{fmt(totals.markup)}</td>
                <td className={totalClass(totals.customer)}>{fmt(totals.customer)}</td>
                {!readOnly && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n) {
  if (!n) return '$0.00';
  const abs = Math.abs(n);
  const formatted = `$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return n < 0 ? `-${formatted}` : formatted;
}
