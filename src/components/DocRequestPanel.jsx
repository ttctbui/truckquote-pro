// src/components/DocRequestPanel.jsx
//
// The doc-request section that lives inside QuoteDetail (or its own tab).
// Renders status, history, and contextual action buttons per role.

import { useState } from 'react';
import {
  canMarkDocIncomplete,
  canMarkDocReady,
  canReopenDocAsJoe,
  canRequestDocUpdate,
} from '../lib/permissions';
import {
  markDocIncomplete,
  markDocReady,
  requestDocUpdate,
  reopenDocAsJoe,
} from '../lib/docRequestActions';
import { DocStatusBadge } from './StatusBadge';

export default function DocRequestPanel({ doc, quote, profile, onUpdated, onError }) {
  const [showIncompleteForm, setShowIncompleteForm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!doc) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        No doc request on this quote yet.
      </div>
    );
  }

  const run = async (fn, args = {}) => {
    setBusy(true);
    const { data, error } = await fn({ doc, quote, profile, ...args });
    setBusy(false);
    if (error) {
      onError?.(error.message);
      return;
    }
    setShowIncompleteForm(false);
    setReason('');
    onUpdated?.(data);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Doc Request</h3>
          <DocStatusBadge doc={doc} />
          {doc.update_request_count > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              · {doc.update_request_count} update{doc.update_request_count === 1 ? '' : 's'} requested
            </span>
          )}
        </div>

        {/* Action buttons by role + status */}
        <div className="flex flex-wrap gap-2">
          {canMarkDocReady(profile, doc) && (
            <button
              onClick={() => run(markDocReady)}
              disabled={busy}
              className="rounded-md bg-[#1E1BB8] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1715A0] disabled:opacity-50"
            >
              ✓ Mark Ready
            </button>
          )}

          {canMarkDocIncomplete(profile, doc) && !showIncompleteForm && (
            <button
              onClick={() => setShowIncompleteForm(true)}
              disabled={busy}
              className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 dark:bg-transparent dark:border-orange-500/60 dark:text-orange-300 dark:hover:bg-orange-500/10 disabled:opacity-50"
            >
              Mark Incomplete
            </button>
          )}

          {canRequestDocUpdate(profile, doc, quote) && (
            <button
              onClick={() => run(requestDocUpdate)}
              disabled={busy}
              className="rounded-md border border-[#1E1BB8] bg-white px-3 py-1.5 text-sm font-medium text-[#1E1BB8] hover:bg-[#1E1BB8]/5 dark:bg-transparent dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-400/10 disabled:opacity-50"
            >
              Request Update
            </button>
          )}

          {canReopenDocAsJoe(profile, doc) && (
            <button
              onClick={() => run(reopenDocAsJoe)}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-transparent dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
              title="Reopen this request without waiting on the salesperson"
            >
              Reopen (override)
            </button>
          )}
        </div>
      </div>

      {/* Incomplete reason — shown to everyone when status = incomplete */}
      {doc.status === 'incomplete' && doc.incomplete_reason && (
        <div className="mt-3 rounded-md border-l-4 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500 dark:bg-red-500/10 dark:text-red-200">
          <span className="font-semibold">Needs: </span>
          {doc.incomplete_reason}
        </div>
      )}

      {/* Incomplete-reason capture form (Joe only) */}
      {showIncompleteForm && (
        <div className="mt-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              What's missing? (required)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Missing proof of insurance, expired DL, need updated W-9"
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1E1BB8] focus:ring-2 focus:ring-[#1E1BB8]/40 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowIncompleteForm(false);
                setReason('');
              }}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => run(markDocIncomplete, { reason })}
              disabled={busy || !reason.trim()}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Mark Incomplete'}
            </button>
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {doc.pending_at && <span>Pending since {fmt(doc.pending_at)}</span>}
        {doc.incomplete_at && doc.status === 'incomplete' && (
          <span>Marked incomplete {fmt(doc.incomplete_at)}</span>
        )}
        {doc.ready_at && <span>Ready {fmt(doc.ready_at)}</span>}
        {doc.last_update_requested_at && (
          <span>Last update requested {fmt(doc.last_update_requested_at)}</span>
        )}
      </div>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
