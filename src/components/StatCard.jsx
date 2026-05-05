/**
 * TTC Standard Stat Card
 *
 * The dashboard summary card used across TTC apps (AP Tracker, TruckQuote Pro, etc).
 * Matches the AP Tracker style: left color bar, label, big number, subline.
 *
 * Tone maps to semantic meaning:
 *   'blue'   → neutral totals
 *   'green'  → success/completed
 *   'orange' → pending/attention
 *   'red'    → urgent/overdue
 *   'yellow' → warning/due-soon
 *   'purple' → duplicates/special
 *
 * Usage:
 *   <StatCard label="Total Invoices" value={5} sub="$13,720.00" tone="blue" />
 *   <StatCard label="Needs Attention" value={5} sub="missing docs" tone="red" />
 */
export default function StatCard({ label, value, sub, tone = 'blue', onClick }) {
  const toneConfig = {
    blue:   { bar: 'bg-stat-blue',   value: 'text-stat-blue',   dot: 'bg-stat-blue' },
    green:  { bar: 'bg-stat-green',  value: 'text-stat-green',  dot: 'bg-stat-green' },
    orange: { bar: 'bg-stat-orange', value: 'text-stat-orange', dot: 'bg-stat-orange' },
    red:    { bar: 'bg-stat-red',    value: 'text-stat-red',    dot: 'bg-stat-red' },
    yellow: { bar: 'bg-stat-yellow', value: 'text-stat-yellow', dot: 'bg-stat-yellow' },
    purple: { bar: 'bg-stat-purple', value: 'text-stat-purple', dot: 'bg-stat-purple' },
  };
  const t = toneConfig[tone] ?? toneConfig.blue;

  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`
        relative w-full text-left
        bg-white dark:bg-dark-surface
        rounded-xl shadow-ttc-card
        dark:border dark:border-dark-border
        p-4 pl-6
        transition-shadow
        ${clickable ? 'hover:shadow-md cursor-pointer' : ''}
      `}
    >
      {/* Left color bar */}
      <span className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full ${t.bar}`} />

      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">
        <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
        {label}
      </div>
      <div className={`mt-1 text-3xl font-bold ${t.value}`}>{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-gray-500 dark:text-dark-muted">{sub}</div>
      )}
    </Tag>
  );
}
