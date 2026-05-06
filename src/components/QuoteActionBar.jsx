// src/components/QuoteActionBar.jsx
//
// Top-right action header for QuoteDetail. Renders only the buttons the
// current user is allowed to click (per src/lib/permissions.js).
// Confirm modals for destructive / irreversible actions.

import { useState } from 'react';
import {
  canApprove,
  canMarkDelivered,
  canMarkLost,
  canArchiveManual,
  canUnarchive,
} from '../lib/permissions';
import {
  approveQuote,
  markDelivered,
  markLost,
  archiveManual,
  unarchive,
} from '../lib/quoteActions';

// ---- shared primitives -----------------------------------------------------

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#1E1BB8] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1715A0] focus:outline-none focus:ring-2 focus:ring-[#1E1BB8]/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#1E1BB8] bg-white px-3 py-1.5 text-sm font-medium text-[#1E1BB8] hover:bg-[#1E1BB8]/5 focus:outline-none focus:ring-2 focus:ring-[#1E1BB8]/40 dark:bg-transparent dark:text-blue-300 dark:border-blue-400 dark:hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 dark:bg-transparent dark:border-red-500/60 dark:text-red-400 dark:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// ---- confirm modal ---------------------------------------------------------

function ConfirmModal({ open, title, body, confirmLabel, danger, onConfirm, onCancel, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:border dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={
              danger
                ? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50'
                : 'rounded-md bg-[#1E1BB8] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1715A0] disabled:opacity-50'
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- main component --------------------------------------------------------

export default function QuoteActionBar({ quote, profile, onUpdated, onError }) {
  const [pending, setPending] = useState(null); // null | 'lost' | 'archive' | 'unarchive'
  const [busy, setBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [lostReason, setLostReason] = useState('');

  const handle = async (fn, args = {}) => {
    setBusy(true);
    const { data, error } = await fn({ quote, profile, ...args });
    setBusy(false);
    setPending(null);
    setArchiveReason('');
    setLostReason('');
    if (error) {
      onError?.(error.message);
      return;
    }
    onUpdated?.(data);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canApprove(profile, quote) && (
          <PrimaryButton onClick={() => handle(approveQuote)} disabled={busy}>
            ✓ Approve
          </PrimaryButton>
        )}

        {canMarkDelivered(profile, quote) && (
          <PrimaryButton onClick={() => handle(markDelivered)} disabled={busy}>
            🚚 Mark Delivered
          </PrimaryButton>
        )}

        {canMarkLost(profile, quote) && (
          <DangerButton onClick={() => setPending('lost')} disabled={busy}>
            Mark Lost
          </DangerButton>
        )}

        {canArchiveManual(profile, quote) && (
          <SecondaryButton onClick={() => setPending('archive')} disabled={busy}>
            Archive
          </SecondaryButton>
        )}

        {canUnarchive(profile, quote) && (
          <SecondaryButton onClick={() => setPending('unarchive')} disabled={busy}>
            Unarchive
          </SecondaryButton>
        )}
      </div>

      {/* Mark Lost modal */}
      <ConfirmModal
        open={pending === 'lost'}
        title="Mark this quote as Lost?"
        body={
          <div className="space-y-3">
            <p>
              The quote will stay visible for <strong>7 days</strong>, then automatically archive.
              You can unarchive it within that window if needed.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Reason (optional)
              </span>
              <input
                type="text"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="e.g. price too high, went with competitor"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1E1BB8] focus:ring-2 focus:ring-[#1E1BB8]/40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </label>
          </div>
        }
        confirmLabel="Mark Lost"
        danger
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => handle(markLost, { reason: lostReason || null })}
      />

      {/* Manual Archive modal */}
      <ConfirmModal
        open={pending === 'archive'}
        title="Archive this quote?"
        body={
          <div className="space-y-3">
            <p>Archived quotes are hidden from the active list. You can unarchive at any time.</p>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Reason
              </span>
              <input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. duplicate of #4521"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1E1BB8] focus:ring-2 focus:ring-[#1E1BB8]/40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </label>
          </div>
        }
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => handle(archiveManual, { reason: archiveReason || 'manual' })}
      />

      {/* Unarchive modal */}
      <ConfirmModal
        open={pending === 'unarchive'}
        title="Unarchive this quote?"
        body={
          <p>
            The quote will return to the active list with its previous status
            (<strong>{quote?.pre_archive_status || quote?.status || 'pending_approval'}</strong>).
          </p>
        }
        confirmLabel="Unarchive"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => handle(unarchive)}
      />
    </>
  );
}
