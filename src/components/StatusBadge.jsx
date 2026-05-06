// src/components/StatusBadge.jsx
//
// Semantic status pills for quotes and doc_requests.
// Colors come from the TTC design system palette.

const QUOTE_STYLES = {
  pending_approval: {
    label: 'Pending Approval',
    cls: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  },
  approved: {
    label: 'Approved',
    cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  },
  delivered: {
    label: 'Delivered',
    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  },
  lost: {
    label: 'Lost',
    cls: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  },
  archived: {
    label: 'Archived',
    cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
};

const DOC_STYLES = {
  pending: {
    label: 'Pending',
    cls: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  },
  incomplete: {
    label: 'Incomplete',
    cls: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  },
  ready: {
    label: 'Ready',
    cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  },
};

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

export function QuoteStatusBadge({ quote }) {
  // Show "Archived" for archived rows even if the underlying status is approved/etc.
  const key = quote?.archived_at ? 'archived' : quote?.status;
  const cfg = QUOTE_STYLES[key] || QUOTE_STYLES.pending_approval;

  // Special-case: Lost-but-not-yet-archived shows days remaining
  if (quote?.status === 'lost' && !quote?.archived_at && quote?.lost_at) {
    const daysLeft = daysUntilAutoArchive(quote.lost_at);
    return (
      <span className={`${BASE} ${cfg.cls}`} title={`Auto-archives in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}>
        {cfg.label} · {daysLeft}d
      </span>
    );
  }

  return <span className={`${BASE} ${cfg.cls}`}>{cfg.label}</span>;
}

export function DocStatusBadge({ doc }) {
  const cfg = DOC_STYLES[doc?.status] || DOC_STYLES.pending;
  return <span className={`${BASE} ${cfg.cls}`}>{cfg.label}</span>;
}

function daysUntilAutoArchive(lostAtIso) {
  const lostMs = new Date(lostAtIso).getTime();
  const archiveMs = lostMs + 7 * 24 * 60 * 60 * 1000;
  const remainingMs = archiveMs - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
