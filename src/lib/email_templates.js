// src/lib/email_templates.js
//
// TTC-branded HTML email templates.
// Each function returns { subject, html } for one event type.
// Pure functions — no DB calls, no side effects. Easy to unit-test.
//
// Design notes:
//   - Inline styles only (Outlook + Gmail strip <style> blocks)
//   - Single-column layout, max 600px wide
//   - TTC Blue (#1E1BB8) header bar, white card body
//   - Inter on systems that have it, fallback to standard sans-serif
//   - Monospace for deal numbers, quote numbers (matches the app)
//   - "View Quote" CTA button uses absolute URL from app_base_url

const TTC_BLUE = '#1E1BB8';
const TTC_BLUE_DARK = '#1715A0';

// -- shared shell --------------------------------------------------------

function shell({ headline, bodyHtml, ctaText, ctaUrl }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:${TTC_BLUE};padding:16px 24px;">
          <div style="color:#ffffff;font-weight:700;font-size:18px;letter-spacing:0.3px;">TruckQuote Pro</div>
          <div style="color:#c7d2fe;font-size:12px;margin-top:2px;">Tom's Truck Center</div>
        </td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:0 24px 24px 24px;font-size:14px;color:#374151;line-height:1.55;">
          ${bodyHtml}
        </td></tr>
        ${ctaUrl ? `
        <tr><td style="padding:0 24px 28px 24px;">
          <a href="${ctaUrl}" style="display:inline-block;background:${TTC_BLUE};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">${ctaText || 'View Quote'}</a>
        </td></tr>` : ''}
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 24px;font-size:11px;color:#6b7280;line-height:1.5;">
          You're receiving this because of activity in TruckQuote Pro. Internal use only.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// helpers
const mono = (s) => `<code style="font-family:'JetBrains Mono',Menlo,Consolas,monospace;background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:13px;">${escapeHtml(s ?? '')}</code>`;
const strong = (s) => `<strong style="color:#111827;">${escapeHtml(s ?? '')}</strong>`;
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function quoteLine(q) {
  // One-liner quote summary for body text
  const parts = [];
  if (q?.quote_number) parts.push(mono(q.quote_number));
  if (q?.customer_name) parts.push(escapeHtml(q.customer_name));
  if (q?.deal_number) parts.push(`Deal ${mono(q.deal_number)}`);
  return parts.join(' &middot; ');
}

// -- 1. Quote needs approval (sales admin + manager) ---------------------

export function quoteApprovalNeeded({ quote, salespersonName, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Quote needs approval: ${quote.quote_number || quote.id.slice(0, 8)}`,
    html: shell({
      headline: 'A new quote needs your approval',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${strong(salespersonName || 'A salesperson')} just submitted a quote for review.</p>
        <p style="margin:0 0 6px 0;">${quoteLine(quote)}</p>
        ${quote.customer_name ? `<p style="margin:14px 0 0 0;color:#6b7280;font-size:13px;">Open the quote to review pricing, gross profit, and approve or send back.</p>` : ''}
      `,
      ctaText: 'Review Quote',
      ctaUrl: url,
    }),
  };
}

// -- 2. Quote approved (salesperson) -------------------------------------

export function quoteApproved({ quote, approverName, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Approved: ${quote.quote_number || quote.id.slice(0, 8)}`,
    html: shell({
      headline: 'Your quote is approved 🎉',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${strong(approverName || 'A sales admin')} approved your quote.</p>
        <p style="margin:0;">${quoteLine(quote)}</p>
      `,
      ctaText: 'View Quote',
      ctaUrl: url,
    }),
  };
}

// -- 3. Deal # requested (sales admins) ----------------------------------

export function dealNumberRequested({ quote, salespersonName, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Deal # requested: ${quote.quote_number || quote.id.slice(0, 8)}`,
    html: shell({
      headline: 'A salesperson is requesting a deal number',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${strong(salespersonName || 'A salesperson')} requested a deal number.</p>
        <p style="margin:0 0 14px 0;">${quoteLine(quote)}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Open the Deal Number tab to assign one.</p>
      `,
      ctaText: 'Assign Deal #',
      ctaUrl: `${baseUrl}/?tab=deal_number`,
    }),
  };
}

// -- 4. Deal # assigned (salesperson) ------------------------------------

export function dealNumberAssigned({ quote, dealNumber, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Deal # ${dealNumber} assigned`,
    html: shell({
      headline: `Deal ${mono(dealNumber)} is yours`,
      bodyHtml: `
        <p style="margin:0 0 14px 0;">A deal number has been assigned to your quote.</p>
        <p style="margin:0;">${quoteLine({ ...quote, deal_number: dealNumber })}</p>
      `,
      ctaText: 'View Quote',
      ctaUrl: url,
    }),
  };
}

// -- 5. New doc request (Joe / F&I) --------------------------------------

export function docRequestNew({ quote, doc, salespersonName, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  const signing = doc.date_of_signing
    ? `${doc.date_of_signing}${doc.time_of_signing ? ' at ' + doc.time_of_signing : ''}`
    : 'not specified';
  return {
    subject: `New doc request: ${quote.customer_name || 'Customer'} (Deal ${doc.deal_number || quote.deal_number || '?'})`,
    html: shell({
      headline: 'New doc request to process',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${strong(salespersonName || 'A salesperson')} submitted a doc request.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Customer</td><td style="padding:6px 0;">${strong(quote.customer_name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Deal #</td><td style="padding:6px 0;">${mono(doc.deal_number || quote.deal_number || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">VIN</td><td style="padding:6px 0;">${mono(doc.vin || quote.vin || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Stock #</td><td style="padding:6px 0;">${mono(doc.stock_number || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Deal Type</td><td style="padding:6px 0;">${escapeHtml(doc.deal_type || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Payment Type</td><td style="padding:6px 0;">${escapeHtml(doc.payment_type || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Signing</td><td style="padding:6px 0;">${escapeHtml(signing)}</td></tr>
          ${doc.is_fleet === 'Yes' ? `<tr><td style="padding:6px 0;color:#6b7280;">Fleet</td><td style="padding:6px 0;">Yes &middot; FIN ${mono(doc.fin_code || '—')}</td></tr>` : ''}
          ${doc.hvip_incentive === 'Yes' ? `<tr><td style="padding:6px 0;color:#6b7280;">HVIP</td><td style="padding:6px 0;">Yes</td></tr>` : ''}
        </table>
      `,
      ctaText: 'Open Doc Request',
      ctaUrl: url,
    }),
  };
}

// -- 6. Doc request marked incomplete (salesperson) ----------------------

export function docRequestIncomplete({ quote, reason, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Docs incomplete: ${quote.customer_name || 'Customer'}`,
    html: shell({
      headline: 'F&I needs more info on your docs',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${quoteLine(quote)}</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 14px;border-radius:6px;margin:0 0 14px 0;color:#78350f;font-size:14px;">
          <strong style="color:#78350f;">What's needed:</strong><br>
          ${escapeHtml(reason || 'See the doc request for details.')}
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">Open the quote, fix what's flagged, then click "Request Update" to send it back to F&I.</p>
      `,
      ctaText: 'Open Quote',
      ctaUrl: url,
    }),
  };
}

// -- 7. Salesperson responded — re-review (Joe / F&I) --------------------

export function docRequestUpdateRequested({ quote, salespersonName, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Re-review: ${quote.customer_name || 'Customer'}`,
    html: shell({
      headline: 'Salesperson responded — please re-review',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">${strong(salespersonName || 'A salesperson')} updated their doc request.</p>
        <p style="margin:0;">${quoteLine(quote)}</p>
      `,
      ctaText: 'Re-review',
      ctaUrl: url,
    }),
  };
}

// -- 8. Docs ready (salesperson) -----------------------------------------

export function docRequestReady({ quote, baseUrl }) {
  const url = `${baseUrl}/quotes/${quote.id}`;
  return {
    subject: `Docs ready: ${quote.customer_name || 'Customer'}`,
    html: shell({
      headline: 'Your docs are ready ✅',
      bodyHtml: `
        <p style="margin:0 0 14px 0;">F&I has finished processing your doc request.</p>
        <p style="margin:0;">${quoteLine(quote)}</p>
      `,
      ctaText: 'View Quote',
      ctaUrl: url,
    }),
  };
}

// -- helpers exported in case actions need them --------------------------

export const _internal = { shell, escapeHtml, mono, strong, quoteLine };
