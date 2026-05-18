/**
 * SwapNaija — Email Templates  (Resend / HTML)
 * Every template returns { subject, html, text }
 * Inject %%FRONTEND_URL%% via injectUrl() before sending.
 */

const G  = '#1D9E75';   // green
const GL = '#E8F8F2';   // green light
const GD = '#158A63';   // green dark
const AM = '#F59E0B';   // amber
const RD = '#EF4444';   // red
const BL = '#3B82F6';   // blue
const GR = '#6B7280';   // gray
const DK = '#111827';   // dark
const BG = '#F9FAFB';   // bg
const BD = '#E5E7EB';   // border

// ─── Base layout ──────────────────────────────────────────────────────────────
const base = (body, { preheader = '' } = {}) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>SwapNaija</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};min-height:100vh;">
<tr><td align="center" style="padding:32px 16px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <!-- Header -->
  <tr><td style="background:${G};border-radius:16px 16px 0 0;padding:20px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <a href="%%FRONTEND_URL%%" style="text-decoration:none;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:38px;height:38px;background:rgba(255,255,255,0.2);border-radius:10px;text-align:center;vertical-align:middle;">
                  <img src="%%FRONTEND_URL%%/logo-email.png" width="22" height="22" alt="SwapNaija" style="display:block;margin:8px auto 0;" />
                </td>
              </tr></table>
            </a>
          </td>
          <td style="vertical-align:middle;">
            <a href="%%FRONTEND_URL%%" style="text-decoration:none;color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">SwapNaija</a>
            <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:1px;letter-spacing:0.3px;">usebarter.online</div>
          </td>
        </tr></table>
      </td>
      <td align="right" style="font-size:11px;color:rgba(255,255,255,0.6);">Nigeria's Barter Marketplace</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;border-left:1px solid ${BD};border-right:1px solid ${BD};padding:32px;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F3F4F6;border:1px solid ${BD};border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;color:${GR};">You're receiving this because you have a SwapNaija account.</p>
    <p style="margin:0;font-size:12px;color:${GR};">
      <a href="%%FRONTEND_URL%%/settings?tab=notifications" style="color:${G};text-decoration:none;">Manage preferences</a>
      &nbsp;·&nbsp;
      <a href="%%FRONTEND_URL%%/settings?tab=notifications&unsubscribe=1" style="color:${GR};text-decoration:none;">Unsubscribe</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

// ─── Reusable helpers ─────────────────────────────────────────────────────────
const btn = (label, url, bg = G) =>
  `<a href="${url}" style="display:inline-block;background:${bg};color:#fff;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px;text-decoration:none;">${label}</a>`;

const hr = () => `<hr style="border:none;border-top:1px solid ${BD};margin:24px 0;"/>`;

const pill = (label, color = G, bg = GL) =>
  `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${label}</span>`;

const hi = (name) =>
  `<p style="margin:0 0 4px;font-size:22px;font-weight:800;color:${DK};">Hey ${name || 'there'} 👋</p>`;

const bc = (kobo) => `${Math.round(kobo / 100).toLocaleString()} BC`;

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
  : 'TBD';

// ─── Swap summary card ────────────────────────────────────────────────────────
const swapSummary = (swap, myRole) => {
  const iL = swap.initiatorListing || {};
  const rL = swap.receiverListing  || {};
  const iName = typeof swap.initiatorId === 'object' ? swap.initiatorId?.fullName : 'Proposer';
  const rName = typeof swap.receiverId  === 'object' ? swap.receiverId?.fullName  : 'Receiver';

  const STATUS_COLOR = {
    proposed:'#3B82F6', accepted:'#1D9E75', in_escrow:'#F59E0B',
    shipped:'#8B5CF6', completed:'#1D9E75', cancelled:'#6B7280', disputed:'#EF4444',
  };
  const STATUS_LABEL = {
    proposed:'Proposed', accepted:'Accepted', in_escrow:'In Escrow',
    shipped:'Shipped 📦', completed:'Completed ✓', cancelled:'Cancelled', disputed:'Disputed',
  };

  const sc = STATUS_COLOR[swap.status] || GR;
  const sl = STATUS_LABEL[swap.status] || swap.status;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BD};border-radius:14px;overflow:hidden;margin:16px 0;">
    <!-- Status bar -->
    <tr><td style="background:${sc};padding:8px 16px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Status: ${sl}</p>
    </td></tr>
    <!-- Listings -->
    <tr>
      <td style="padding:16px;width:44%;vertical-align:top;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:${GR};text-transform:uppercase;">${myRole === 'initiator' ? '▶ Your Offer' : '◀ Their Offer'}</p>
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${DK};">${iL.title || '—'}</p>
        ${iL.estimatedValue ? `<p style="margin:0;font-size:12px;color:${G};font-weight:600;">${Number(iL.estimatedValue).toLocaleString()} BC</p>` : ''}
        ${iL.condition ? `<p style="margin:4px 0 0;font-size:11px;color:${GR};">Condition: ${iL.condition}</p>` : ''}
        <p style="margin:6px 0 0;font-size:11px;color:${GR};">by ${iName}</p>
      </td>
      <td style="width:12%;text-align:center;vertical-align:middle;font-size:22px;">⇄</td>
      <td style="padding:16px;width:44%;vertical-align:top;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:${GR};text-transform:uppercase;">${myRole === 'receiver' ? '▶ Your Offer' : '◀ Their Offer'}</p>
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${DK};">${rL.title || '—'}</p>
        ${rL.estimatedValue ? `<p style="margin:0;font-size:12px;color:${G};font-weight:600;">${Number(rL.estimatedValue).toLocaleString()} BC</p>` : ''}
        ${rL.condition ? `<p style="margin:4px 0 0;font-size:11px;color:${GR};">Condition: ${rL.condition}</p>` : ''}
        <p style="margin:6px 0 0;font-size:11px;color:${GR};">by ${rName}</p>
      </td>
    </tr>
    <!-- Escrow row if applicable -->
    ${swap.escrowDepositKobo ? `
    <tr><td colspan="3" style="border-top:1px solid ${BD};padding:10px 16px;background:#FAFAFA;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;color:${GR};">🔒 Escrow per party: <strong style="color:${DK};">${bc(swap.escrowDepositKobo)}</strong></td>
        ${swap.topUpAmountKobo > 0 ? `<td align="right" style="font-size:12px;color:${AM};">Top-up gap: <strong>${bc(swap.topUpAmountKobo)}</strong></td>` : ''}
      </tr></table>
    </td></tr>` : ''}
    ${swap.proposalNote ? `
    <tr><td colspan="3" style="border-top:1px solid ${BD};padding:10px 16px;">
      <p style="margin:0;font-size:12px;color:${DK};">💬 <em>"${swap.proposalNote}"</em></p>
    </td></tr>` : ''}
  </table>`;
};

// ─── Progress steps ───────────────────────────────────────────────────────────
const steps = (list) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
  ${list.map(([done, label]) => `
    <tr><td style="padding:5px 0;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:24px;height:24px;border-radius:50%;background:${done ? G : BD};text-align:center;vertical-align:middle;font-size:12px;color:#fff;font-weight:700;">${done ? '✓' : '·'}</td>
        <td style="padding-left:10px;font-size:13px;color:${done ? DK : GR};font-weight:${done ? '600' : '400'};">${label}</td>
      </tr></table>
    </td></tr>`).join('')}
  </table>`;

// ─── Financial breakdown ──────────────────────────────────────────────────────
const finRow = (label, value, color = DK) =>
  `<tr>
    <td style="padding:6px 0;font-size:13px;color:${GR};">${label}</td>
    <td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:${color};">${value}</td>
  </tr>`;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SWAP PROPOSED → receiver
// ═══════════════════════════════════════════════════════════════════════════════
const swapProposed = ({ receiver, initiator, swap, frontendUrl }) => {
  const name = receiver.fullName?.split(' ')[0] || 'there';
  const subject = `🔄 New swap proposal from ${initiator.fullName || 'someone'} — respond now!`;
  const iVal = swap.initiatorListing?.estimatedValue;
  const rVal = swap.receiverListing?.estimatedValue;
  const hasTopUp = swap.topUpAmountKobo > 0;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${initiator.fullName}</strong> wants to swap with you on SwapNaija.
      Review the proposal below and let them know — proposals expire after 7 days.
    </p>

    ${swapSummary(swap, 'receiver')}

    ${hasTopUp ? `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400E;">⚖️ Value gap included</p>
      <p style="margin:0;font-size:13px;color:#78350F;">
        This proposal includes a top-up of <strong>${bc(swap.topUpAmountKobo)}</strong>
        payable by the <strong>${swap.topUpPayerRole}</strong> to balance the value difference.
      </p>
    </div>` : ''}

    ${iVal && rVal ? `
    <div style="background:${GL};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Their item estimated value', `${Number(iVal).toLocaleString()} BC`)}
        ${finRow('Your item estimated value', `${Number(rVal).toLocaleString()} BC`)}
        ${finRow('Escrow collateral (each)', bc(swap.escrowDepositKobo || 0), G)}
      </table>
    </div>` : ''}

    ${steps([
      [false, 'You accept or decline this proposal'],
      [false, 'Both parties pay escrow deposit (optional but recommended)'],
      [false, 'Ship items to each other via courier'],
      [false, 'Both confirm receipt — swap complete!'],
    ])}

    <div style="text-align:center;margin:24px 0 8px;">
      ${btn('👀 View & Respond to Proposal', `${frontendUrl}/swaps`)}
    </div>
    <p style="text-align:center;margin:0;font-size:12px;color:${GR};">Tap the button to accept or decline in the app</p>
  `, { preheader: `${initiator.fullName} wants to swap with you — respond now` });

  return { subject, html, text: `${initiator.fullName} proposed a swap. View at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SWAP ACCEPTED → initiator
// ═══════════════════════════════════════════════════════════════════════════════
const swapAccepted = ({ initiator, receiver, swap, frontendUrl }) => {
  const name = initiator.fullName?.split(' ')[0] || 'there';
  const subject = `🎉 ${receiver.fullName} accepted your swap proposal!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Great news! <strong style="color:${DK};">${receiver.fullName}</strong> has
      <span style="color:${G};font-weight:700;">accepted</span> your swap proposal.
      Your deal is now live — secure it with escrow and arrange delivery.
    </p>

    ${swapSummary(swap, 'initiator')}

    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${DK};">Choose your next step:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:48%;padding:14px;background:${GL};border:1px solid #BBF7D0;border-radius:10px;vertical-align:top;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${G};">🔒 Pay Escrow (Recommended)</p>
          <p style="margin:0;font-size:12px;color:${GR};line-height:1.6;">Both parties deposit ${bc(swap.escrowDepositKobo || 0)} as collateral. Refunded on completion minus 2% fee.</p>
        </td>
        <td style="width:4%;"></td>
        <td style="width:48%;padding:14px;background:#F9FAFB;border:1px solid ${BD};border-radius:10px;vertical-align:top;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${DK};">📦 Arrange Delivery</p>
          <p style="margin:0;font-size:12px;color:${GR};line-height:1.6;">Submit courier tracking info once escrow is active and your item is shipped.</p>
        </td>
      </tr>
    </table>

    ${steps([
      [true,  'Proposal sent'],
      [true,  `${receiver.fullName} accepted ✓`],
      [false, 'Pay escrow deposit to protect the swap'],
      [false, 'Ship your item and submit tracking info'],
      [false, 'Both confirm receipt — done!'],
    ])}

    <div style="text-align:center;margin:24px 0 8px;">
      ${btn('🚀 Continue the Swap', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `${receiver.fullName} accepted your swap — next step is yours!` });

  return { subject, html, text: `${receiver.fullName} accepted your swap. Continue at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SWAP DECLINED → initiator
// ═══════════════════════════════════════════════════════════════════════════════
const swapDeclined = ({ initiator, receiver, swap, frontendUrl }) => {
  const name = initiator.fullName?.split(' ')[0] || 'there';
  const subject = `Your swap proposal was declined by ${receiver.fullName}`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${receiver.fullName}</strong> has declined your swap proposal.
      Don't be discouraged — the right swap partner is out there!
    </p>

    ${swapSummary(swap, 'initiator')}

    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#991B1B;">
        ❌ This proposal has been <strong>declined</strong>. No charges were made to your wallet.
      </p>
    </div>

    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${DK};">What to do next:</p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:13px;color:${GR};line-height:2.2;">
      <li>Browse other listings that match what you're offering</li>
      <li>Update your listing with better photos or a clearer description</li>
      <li>Try proposing to other users interested in similar items</li>
    </ul>

    <div style="text-align:center;">
      ${btn('🔍 Browse More Listings', `${frontendUrl}/listings`, GD)}
    </div>
  `, { preheader: `${receiver.fullName} declined your proposal — keep exploring!` });

  return { subject, html, text: `${receiver.fullName} declined your swap. Browse listings at ${frontendUrl}/listings` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SWAP CANCELLED → other party
// ═══════════════════════════════════════════════════════════════════════════════
const swapCancelled = ({ user, canceller, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const hadEscrow = swap.escrowActive || swap.initiatorDepositPaid || swap.receiverDepositPaid;
  const subject = `Swap cancelled by ${canceller?.fullName || 'your partner'}`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${canceller?.fullName || 'Your swap partner'}</strong> has cancelled
      the swap. We're sorry it didn't work out this time.
    </p>

    ${swapSummary(swap, 'receiver')}

    ${hadEscrow ? `
    <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${G};">💰 Escrow Refund Processed</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Your deposit', bc(swap.escrowDepositKobo || 0))}
        ${finRow('Refunded to wallet', bc(swap.escrowDepositKobo || 0), G)}
        ${finRow('Platform fee', '₦0 (cancellation is free)')}
      </table>
      <p style="margin:8px 0 0;font-size:12px;color:${GR};">Your full deposit has been returned to your Barter Credits wallet.</p>
    </div>` : `
    <div style="background:${BG};border:1px solid ${BD};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:${GR};">No escrow was active — no charges were made to your wallet.</p>
    </div>`}

    <div style="text-align:center;">
      ${btn('🔍 Find a New Swap', `${frontendUrl}/listings`, GD)}
    </div>
  `, { preheader: `${canceller?.fullName} cancelled the swap${hadEscrow ? ' — your deposit has been refunded' : ''}` });

  return { subject, html, text: `Swap cancelled by ${canceller?.fullName}. Visit ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SHIPMENT SUBMITTED → other party
// ═══════════════════════════════════════════════════════════════════════════════
const shipmentSubmitted = ({ user, shipper, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const subject = `📦 ${shipper?.fullName || 'Your swap partner'} has shipped your item`;

  const shipmentsData = swap.initiatorShipment || swap.receiverShipment || {};

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${shipper?.fullName || 'Your swap partner'}</strong> has dispatched their item and submitted tracking info.
      Your package is on its way — keep an eye on the tracking number below.
    </p>

    ${swapSummary(swap, 'receiver')}

    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:14px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:${G};text-transform:uppercase;letter-spacing:0.5px;">🚚 Shipment Details</p>
      ${shipmentsData.trackingNumber ? `
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${GR};">Courier</td>
          <td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:${DK};">${shipmentsData.providerLabel || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${GR};">Tracking Number</td>
          <td align="right" style="padding:6px 0;font-size:14px;font-weight:800;color:${DK};font-family:monospace;">${shipmentsData.trackingNumber}</td>
        </tr>
        ${shipmentsData.estimatedDelivery ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${GR};">Est. Delivery</td>
          <td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:${G};">${fmtDate(shipmentsData.estimatedDelivery)}</td>
        </tr>` : ''}
      </table>` : '<p style="margin:0;font-size:14px;color:#6B7280;">Tracking details available in the app.</p>'}
    </div>

    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400E;">⚠️ On delivery — important:</p>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350F;line-height:2.2;">
        <li>Inspect the item carefully when it arrives</li>
        <li>Only confirm receipt when you are fully satisfied with the item</li>
        <li>Raise a dispute immediately in the app if there is any issue — your escrow is protected</li>
      </ul>
    </div>

    ${steps([
      [true,  'Proposal accepted & escrow paid'],
      [true,  `${shipper?.fullName} shipped their item ✓`],
      [false, 'You ship your item and submit tracking'],
      [false, 'Both parties receive and inspect items'],
      [false, 'Both confirm receipt — escrow refunded!'],
    ])}

    <div style="text-align:center;margin:24px 0 8px;">
      ${btn('📦 View Swap & Track Delivery', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `${shipper?.fullName} shipped your item — tracking info inside` });

  return {
    subject,
    html,
    text: `${shipper?.fullName || 'Your swap partner'} shipped your item. Track at ${frontendUrl}/swaps`,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ESCROW DEPOSIT PAID — one party paid, waiting on other
// ═══════════════════════════════════════════════════════════════════════════════
const escrowDepositNeeded = ({ user, payer, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const depositBC = bc(swap.escrowDepositKobo || 0);
  const fee = Math.round((swap.escrowDepositKobo || 0) * 0.02);
  const refund = (swap.escrowDepositKobo || 0) - fee;
  const subject = `⏳ ${payer.fullName} paid escrow — your deposit is the last step!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${payer.fullName}</strong> has already paid their escrow deposit.
      Now it's your turn — once you pay, the swap is secured for both of you!
    </p>

    ${swapSummary(swap, 'receiver')}

    <!-- Payment breakdown -->
    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:14px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${G};">💳 Escrow Payment Breakdown</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Deposit required from you', depositBC, DK)}
        ${finRow('Platform fee (2%, charged on completion)', bc(fee), GR)}
        ${finRow('You get back on completion', bc(refund), G)}
      </table>
    </div>

    <!-- Escrow status -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px solid ${G};text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:${GR};">PAID ✓</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:${G};">${payer.fullName}</p>
        </td>
        <td style="width:4%;text-align:center;font-size:18px;">→</td>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px dashed ${AM};text-align:center;background:#FFFBEB;">
          <p style="margin:0 0 4px;font-size:11px;color:${AM};">WAITING ⏳</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:#92400E;">You</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin:0 0 12px;">
      ${btn('💳 Pay ' + depositBC + ' Escrow Now', `${frontendUrl}/swaps`)}
    </div>
    <p style="text-align:center;margin:0;font-size:12px;color:${GR};">
      Need Barter Credits? <a href="${frontendUrl}/wallet" style="color:${G};text-decoration:none;">Top up your wallet →</a>
    </p>
  `, { preheader: `${payer.fullName} paid escrow — pay yours (${depositBC}) to activate protection` });

  return { subject, html, text: `${payer.fullName} paid escrow. Pay yours (${depositBC}) at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ESCROW FULLY ACTIVE — both paid
// ═══════════════════════════════════════════════════════════════════════════════
const escrowActivated = ({ user, otherUser, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const fee = Math.round((swap.escrowDepositKobo || 0) * 0.02);
  const refund = (swap.escrowDepositKobo || 0) - fee;
  const subject = `🔒 Escrow is LIVE — your swap is fully protected!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Both you and <strong style="color:${DK};">${otherUser?.fullName}</strong> have paid the escrow deposit.
      Your swap is now <strong style="color:${G};">secured by SwapNaija Escrow</strong> 🛡️
      — ship your item and submit the tracking number to continue.
    </p>

    ${swapSummary(swap, 'initiator')}

    <!-- Both paid confirmation -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px solid ${G};text-align:center;background:${GL};">
          <p style="margin:0 0 4px;font-size:11px;color:${G};">PAID ✓</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:${DK};">${user.fullName}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${G};">${bc(swap.escrowDepositKobo || 0)}</p>
        </td>
        <td style="width:4%;text-align:center;font-size:18px;">🔒</td>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px solid ${G};text-align:center;background:${GL};">
          <p style="margin:0 0 4px;font-size:11px;color:${G};">PAID ✓</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:${DK};">${otherUser?.fullName}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${G};">${bc(swap.escrowDepositKobo || 0)}</p>
        </td>
      </tr>
    </table>

    <div style="background:${GL};border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${G};">What happens to your escrow:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Your deposit held', bc(swap.escrowDepositKobo || 0))}
        ${finRow('Returned on completion', bc(refund), G)}
        ${finRow('Platform fee (on completion only)', bc(fee), GR)}
        ${finRow('If cancelled before shipping', bc(swap.escrowDepositKobo || 0) + ' full refund', G)}
      </table>
    </div>

    ${steps([
      [true,  'Proposal accepted'],
      [true,  'Escrow active — both parties protected'],
      [false, 'Ship your item and submit tracking info'],
      [false, 'Both parties receive and inspect items'],
      [false, 'Both confirm receipt — escrow refunded!'],
    ])}

    <div style="text-align:center;">
      ${btn('📦 Submit Shipment Now', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: 'Escrow is live — ship your item and submit tracking to continue!' });

  return { subject, html, text: `Escrow active for your swap with ${otherUser?.fullName}. Ship your item at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ONE PARTY CONFIRMED — waiting for other (partial)
// ═══════════════════════════════════════════════════════════════════════════════
const onePartyConfirmed = ({ user, confirmer, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const subject = `✅ ${confirmer.fullName} confirmed receipt — your turn to confirm!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${confirmer.fullName}</strong> has confirmed they received their item.
      <strong>You're the last step</strong> — confirm receipt now to complete the deal and release escrow funds.
    </p>

    ${swapSummary(swap, 'receiver')}

    <!-- Confirmation status -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px solid ${G};text-align:center;background:${GL};">
          <p style="margin:0 0 4px;font-size:11px;color:${G};">CONFIRMED ✓</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:${DK};">${confirmer.fullName}</p>
          <p style="margin:2px 0 0;font-size:11px;color:${GR};">Item received & confirmed</p>
        </td>
        <td style="width:4%;text-align:center;font-size:18px;color:${AM};">!</td>
        <td style="width:48%;padding:12px;border-radius:10px;border:2px dashed ${AM};text-align:center;background:#FFFBEB;">
          <p style="margin:0 0 4px;font-size:11px;color:${AM};">WAITING ⏳</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:${DK};">${user.fullName}</p>
          <p style="margin:2px 0 0;font-size:11px;color:${AM};">Action required!</p>
        </td>
      </tr>
    </table>

    ${swap.escrowActive ? `
    <div style="background:${GL};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${G};">💰 What happens when you confirm:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Your escrow deposit', bc(swap.escrowDepositKobo || 0))}
        ${finRow('Platform fee (2%)', bc(Math.round((swap.escrowDepositKobo || 0) * 0.02)))}
        ${finRow('Refunded to your wallet', bc(Math.round((swap.escrowDepositKobo || 0) * 0.98)), G)}
      </table>
    </div>` : ''}

    <div style="text-align:center;margin:24px 0 8px;">
      ${btn('✅ Confirm Receipt', `${frontendUrl}/swaps`)}
    </div>
    <p style="text-align:center;margin:0;font-size:12px;color:${GR};">
      Only confirm if you have received and inspected the item and are fully satisfied.
    </p>
  `, { preheader: `${confirmer.fullName} confirmed — you're the last step to completing this swap!` });

  return { subject, html, text: `${confirmer.fullName} confirmed receipt. Confirm yours at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SWAP COMPLETED — both confirmed
// ═══════════════════════════════════════════════════════════════════════════════
const swapCompleted = ({ user, otherUser, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const hadEscrow = swap.escrowActive && swap.escrowDepositKobo > 0;
  const refundBC = hadEscrow ? bc(Math.round(swap.escrowDepositKobo * 0.98)) : null;
  const feeBC    = hadEscrow ? bc(Math.round(swap.escrowDepositKobo * 0.02)) : null;
  const subject = `🎊 Swap complete! You swapped with ${otherUser?.fullName} — leave a review`;

  const html = base(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:56px;line-height:1.2;">🎊</div>
      <h1 style="margin:8px 0 4px;font-size:24px;font-weight:800;color:${DK};">Swap Complete!</h1>
      <p style="margin:0;font-size:15px;color:${GR};">You and <strong style="color:${DK};">${otherUser?.fullName}</strong> successfully swapped.</p>
    </div>

    ${swapSummary(swap, 'initiator')}

    ${hadEscrow ? `
    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:14px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${G};">💰 Escrow Settlement</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Original deposit', bc(swap.escrowDepositKobo))}
        ${finRow('Platform fee (2%)', feeBC, GR)}
        ${finRow('Refunded to your wallet ✓', refundBC, G)}
      </table>
      <div style="margin-top:12px;background:#fff;border-radius:8px;padding:10px 14px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:${G};">+${refundBC} added to your Barter Credits wallet!</p>
      </div>
    </div>` : ''}

    ${swap.swapCount !== undefined ? `
    <div style="background:#EFF6FF;border-radius:10px;padding:14px 16px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#1D4ED8;">🏆 Your swap count is now <strong>${(swap.swapCount || 0) + 1}</strong></p>
    </div>` : ''}

    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${DK};">Help the community — leave a review!</p>
    <p style="margin:0 0 20px;font-size:13px;color:${GR};line-height:1.7;">
      Tell others what it was like to swap with <strong>${otherUser?.fullName}</strong>.
      Reviews build trust and keep SwapNaija safe for everyone. It takes 30 seconds.
    </p>

    <div style="text-align:center;margin:0 0 16px;">
      ${btn('⭐ Leave a Review', `${frontendUrl}/swaps`)}
    </div>
    ${hr()}
    <div style="text-align:center;">
      ${btn('🔄 Find Your Next Swap', `${frontendUrl}/listings`, GR)}
    </div>
  `, { preheader: `Swap complete!${refundBC ? ` ${refundBC} refunded to your wallet.` : ''} Leave a review for ${otherUser?.fullName}` });

  return { subject, html, text: `Swap completed with ${otherUser?.fullName}.${refundBC ? ` ${refundBC} refunded.` : ''} Leave a review at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. TOP-UP REQUIRED → payer
// ═══════════════════════════════════════════════════════════════════════════════
const topUpRequired = ({ user, otherUser, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const topBC = bc(swap.topUpAmountKobo || 0);
  const iVal = swap.initiatorListing?.estimatedValue || 0;
  const rVal = swap.receiverListing?.estimatedValue  || 0;
  const subject = `💸 You owe a ${topBC} value-gap top-up to proceed`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Your swap with <strong style="color:${DK};">${otherUser?.fullName}</strong> has a value difference
      that needs to be balanced before the swap can proceed.
    </p>

    ${swapSummary(swap, swap.topUpPayerRole === 'initiator' ? 'initiator' : 'receiver')}

    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#92400E;">⚖️ Value Gap Breakdown</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Your item value', `${Number(iVal).toLocaleString()} BC`)}
        ${finRow('Their item value', `${Number(rVal).toLocaleString()} BC`)}
        ${finRow('Gap to be bridged', topBC, AM)}
        ${finRow('You pay (as ' + swap.topUpPayerRole + ')', topBC, RD)}
        ${finRow('Released to other party on completion', topBC, GR)}
      </table>
    </div>

    <div style="background:${GL};border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:${G};">
        ℹ️ This top-up is <strong>held in escrow</strong> and released to <strong>${otherUser?.fullName}</strong>
        only when the swap is completed and both parties confirm.
        If the swap is cancelled, it's <strong>refunded to you in full</strong>.
      </p>
    </div>

    <div style="text-align:center;margin:0 0 12px;">
      ${btn('💸 Pay ' + topBC + ' Top-up Now', `${frontendUrl}/swaps`, AM)}
    </div>
    <p style="text-align:center;margin:0;font-size:12px;color:${GR};">
      Need Barter Credits? <a href="${frontendUrl}/wallet" style="color:${G};text-decoration:none;">Top up your wallet →</a>
    </p>
  `, { preheader: `${topBC} top-up required to continue your swap with ${otherUser?.fullName}` });

  return { subject, html, text: `You need to pay ${topBC} top-up. Visit ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. TOP-UP PAID → receiving party
// ═══════════════════════════════════════════════════════════════════════════════
const topUpPaid = ({ user, payer, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const topBC = bc(swap.topUpAmountKobo || 0);
  const subject = `💰 ${payer.fullName} paid the ${topBC} value-gap top-up!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      <strong style="color:${DK};">${payer.fullName}</strong> has paid the
      <strong style="color:${G};">${topBC}</strong> value-gap top-up.
      When the swap is completed, this amount will be transferred to your Barter Credits wallet.
    </p>

    ${swapSummary(swap, 'receiver')}

    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:${GR};">You'll receive on completion</p>
      <p style="margin:0;font-size:36px;font-weight:800;color:${G};">+${topBC}</p>
      <p style="margin:4px 0 0;font-size:12px;color:${GR};">Added to your wallet when both parties confirm receipt</p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:${GR};line-height:1.7;">
      All funds are held securely in escrow.
      Ship your item, submit tracking info, and confirm receipt in the app to release everything.
    </p>

    <div style="text-align:center;">
      ${btn('📋 View Swap', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `${payer.fullName} paid the ${topBC} top-up — it's yours on completion!` });

  return { subject, html, text: `${payer.fullName} paid ${topBC} top-up. It'll be released to you on completion. View at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. DISPUTE RAISED → both parties
// ═══════════════════════════════════════════════════════════════════════════════
const disputeRaised = ({ user, raiser, swap, isRaiser, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const subject = isRaiser
    ? `🚨 Your dispute has been submitted — we're on it`
    : `🚨 ${raiser?.fullName} raised a dispute on your swap`;

  const html = base(`
    ${hi(name)}
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:18px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991B1B;">⚠️ Dispute In Progress</p>
      <p style="margin:0;font-size:13px;color:#7F1D1D;line-height:1.7;">
        ${isRaiser
          ? `Your dispute has been received. An admin judge will open a court room and contact both parties within <strong>24–48 hours</strong>.`
          : `<strong>${raiser?.fullName}</strong> has raised a dispute on this swap. An admin judge will be assigned and will investigate both sides.`
        }
      </p>
    </div>

    ${swapSummary(swap, isRaiser ? 'initiator' : 'receiver')}

    ${swap.disputeReason ? `
    <div style="background:#F9FAFB;border-left:4px solid ${RD};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${GR};text-transform:uppercase;">Reason filed</p>
      <p style="margin:0;font-size:13px;color:${DK};">"${swap.disputeReason}"</p>
    </div>` : ''}

    ${swap.escrowActive ? `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400E;">🔒 Escrow is frozen</p>
      <p style="margin:0;font-size:13px;color:#78350F;">
        All escrow deposits (${bc(swap.escrowDepositKobo || 0)} × 2) are frozen until the dispute is resolved.
        No funds will be released or refunded until the admin judge makes a ruling.
      </p>
    </div>` : ''}

    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${DK};">While the dispute is open:</p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:13px;color:${GR};line-height:2.2;">
      <li>Keep all receipts, photos, tracking numbers, and chat records as evidence</li>
      <li>You may be contacted by our admin team for your account of events</li>
      <li>Do not attempt to resolve this outside the platform</li>
      <li>Do not ship or transfer anything further until the dispute is resolved</li>
    </ul>

    <div style="text-align:center;">
      ${btn('📋 View Dispute Details', `${frontendUrl}/swaps`, RD)}
    </div>
  `, { preheader: isRaiser ? 'Dispute submitted — our admin team is reviewing' : `${raiser?.fullName} raised a dispute — funds frozen` });

  return { subject, html, text: `Dispute ${isRaiser ? 'submitted' : 'raised'} on your swap. View at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12b. DISPUTE RULED → both parties
// ═══════════════════════════════════════════════════════════════════════════════
const disputeRuled = ({ user, ruling, swap, swapId, adminName, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const caseRef = swapId?.toString().slice(-8).toUpperCase() || '';

  const DECISION_LABELS = {
    compensate_initiator: 'Compensation awarded to Initiator',
    compensate_receiver:  'Compensation awarded to Receiver',
    split:                'Escrow split equally between both parties',
    mutual_release:       'Mutual release — no penalty for either party',
    penalty_initiator:    'Penalty issued against Initiator',
    penalty_receiver:     'Penalty issued against Receiver',
  };

  const decisionLabel = DECISION_LABELS[ruling.decision] || ruling.decision;
  const hasCompensation = ruling.compensationAmountKobo > 0;
  const hasPenalty      = ruling.penaltyAmountKobo > 0;

  const subject = `⚖️ Dispute ruling issued — Case #${caseRef}`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      An admin judge has issued a <strong style="color:${DK};">formal ruling</strong> on your dispute.
      This decision is final and binding. Please review the details below.
    </p>

    <!-- Ruling card -->
    <div style="background:linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%);border:2px solid #FCD34D;border-radius:16px;padding:24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:24px;">⚖️</span>
        <div>
          <p style="margin:0;font-size:11px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:1px;">Formal Ruling — Case #${caseRef}</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:800;color:#78350F;">${decisionLabel}</p>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        ${hasCompensation ? finRow('Compensation amount', bc(ruling.compensationAmountKobo), '#D97706') : ''}
        ${hasPenalty      ? finRow('Penalty amount', bc(ruling.penaltyAmountKobo), RD) : ''}
        ${finRow('Issued by', adminName || 'SwapNaija Admin', DK)}
      </table>

      ${ruling.adminNote ? `
      <div style="background:#fff;border-radius:10px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;">Administrator's Note</p>
        <p style="margin:0;font-size:13px;color:${DK};line-height:1.7;font-style:italic;">"${ruling.adminNote}"</p>
      </div>` : ''}
    </div>

    ${swap?.escrowActive ? `
    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${G};">💰 Escrow settlement</p>
      <p style="margin:0;font-size:13px;color:${GR};line-height:1.7;">
        Frozen escrow funds will be disbursed according to the ruling above.
        Any refunds or transfers will appear in your wallet within 1–2 business days.
      </p>
    </div>` : ''}

    <p style="margin:0 0 20px;font-size:13px;color:${GR};line-height:1.7;">
      If you have questions about this ruling, please contact our support team via the app.
      This proceeding is now closed — no further messages can be sent in the dispute room.
    </p>

    <div style="text-align:center;">
      ${btn('📋 View Full Ruling', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `Ruling issued for Case #${caseRef}: ${decisionLabel}` });

  return { subject, html, text: `Dispute ruling issued for Case #${caseRef}: ${decisionLabel}. View at ${frontendUrl}/swaps` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. WELCOME
// ═══════════════════════════════════════════════════════════════════════════════
const welcomeEmail = ({ user, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'trader';
  const subject = `🎉 Welcome to SwapNaija, ${name}! Your barter journey starts here`;

  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;line-height:1.2;">🔄</div>
      <h1 style="margin:10px 0 4px;font-size:24px;font-weight:800;color:${DK};">Welcome to SwapNaija!</h1>
      <p style="margin:0;font-size:14px;color:${GR};">Nigeria's #1 peer-to-peer barter marketplace · usebarter.online</p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Hey <strong style="color:${DK};">${name}</strong>! You're now part of a growing community
      of Nigerians trading goods and services without spending cash.
    </p>

    ${[
      ['1️⃣', 'List what you have', 'Add your items or services with photos — it takes 2 minutes', `${frontendUrl}/create`, 'Create Listing →'],
      ['2️⃣', 'Browse listings', 'Discover thousands of items ready to swap across Nigeria', `${frontendUrl}/listings`, 'Browse Now →'],
      ['3️⃣', 'Propose a swap', 'Found something you like? Send a proposal instantly', `${frontendUrl}/listings`, 'Start Swapping →'],
      ['4️⃣', 'Stay protected', 'Escrow + courier delivery — all swaps are delivery-based for your safety', `${frontendUrl}/swaps`, 'Learn More →'],
    ].map(([e, t, d, l, cta]) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;background:${BG};border-radius:12px;padding:0;">
        <tr>
          <td style="padding:14px 16px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:22px;padding-right:14px;vertical-align:top;">${e}</td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:${DK};">${t}</p>
                <p style="margin:0 0 6px;font-size:12px;color:${GR};">${d}</p>
                <a href="${l}" style="font-size:12px;font-weight:700;color:${G};text-decoration:none;">${cta}</a>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>`).join('')}

    ${hr()}
    <div style="text-align:center;">
      ${btn('🚀 Open SwapNaija', frontendUrl)}
    </div>
  `, { preheader: `Welcome ${name}! Your SwapNaija account is ready. Start swapping today.` });

  return { subject, html, text: `Welcome to SwapNaija, ${name}! Start at ${frontendUrl}` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 14–16. DAILY DIGESTS (morning / afternoon / night)
// ═══════════════════════════════════════════════════════════════════════════════
const morningDigest = ({ user, pendingActions, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const { pendingProposals = [], awaitingEscrow = [], awaitingConfirm = [] } = pendingActions;
  const total = pendingProposals.length + awaitingEscrow.length + awaitingConfirm.length;
  const subject = total > 0
    ? `☀️ Good morning ${name}! ${total} action${total > 1 ? 's' : ''} waiting for you`
    : `☀️ Good morning ${name}! Fresh listings are waiting`;

  const row = (emoji, title, detail, url) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid ${BD};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:32px;font-size:18px;vertical-align:middle;">${emoji}</td>
        <td style="vertical-align:middle;padding:0 8px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:${DK};">${title}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${GR};">${detail}</p>
        </td>
        <td style="text-align:right;vertical-align:middle;">
          <a href="${url}" style="font-size:12px;font-weight:700;color:${G};text-decoration:none;white-space:nowrap;">Act →</a>
        </td>
      </tr></table>
    </td></tr>`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      ${total > 0
        ? `You have <strong style="color:${G};">${total} item${total > 1 ? 's' : ''}</strong> needing your attention today. Let's get them done!`
        : `No urgent actions today — perfect time to browse fresh listings and find your next swap!`}
    </p>

    ${total > 0 ? `
    <div style="border:1px solid ${BD};border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <div style="background:${G};padding:10px 16px;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">⚡ Action Items</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 16px;">
        ${pendingProposals.slice(0, 3).map(s => row('📨', `Proposal from ${s.initiatorId?.fullName || 'Someone'}`, s.initiatorListing?.title ? `Offering: ${s.initiatorListing.title}` : 'Awaiting your response', `${frontendUrl}/swaps`)).join('')}
        ${awaitingEscrow.slice(0, 2).map(s => row('💳', `Pay escrow — ${s.otherUser?.fullName || 'partner'} already paid`, `Deposit: ${bc(s.escrowDepositKobo || 0)}`, `${frontendUrl}/swaps`)).join('')}
        ${awaitingConfirm.slice(0, 2).map(s => row('✅', `Confirm receipt for swap with ${s.otherUser?.fullName || 'partner'}`, 'They confirmed — you\'re the last step!', `${frontendUrl}/swaps`)).join('')}
      </table>
    </div>` : ''}

    <div style="text-align:center;margin-bottom:12px;">
      ${btn('Open SwapNaija', frontendUrl)}
    </div>
    ${hr()}
    <p style="margin:0;font-size:12px;color:${GR};text-align:center;">
      💡 <strong>Pro tip:</strong> Add photos to your listings for 3× more proposals.
      <a href="${frontendUrl}/create" style="color:${G};text-decoration:none;">List something new →</a>
    </p>
  `, { preheader: total > 0 ? `${total} actions waiting for you today!` : 'Good morning — fresh listings are waiting' });

  return { subject, html, text: `Good morning ${name}! ${total} actions waiting. Visit ${frontendUrl}` };
};

const afternoonDigest = ({ user, stats, suggestions, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const { swapsThisWeek = 0, activeSwaps = 0, walletBC = 0 } = stats;
  const subject = `🌤️ Afternoon check-in, ${name} — ${activeSwaps} active swap${activeSwaps !== 1 ? 's' : ''}`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Here's your midday snapshot.
      ${activeSwaps > 0
        ? `You have <strong style="color:${G};">${activeSwaps} active swap${activeSwaps > 1 ? 's' : ''}</strong> in progress right now.`
        : `No active swaps — a fresh opportunity is one proposal away!`}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:32%;text-align:center;padding:16px 8px;background:${GL};border-radius:12px 0 0 12px;border:1px solid #BBF7D0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${GR};text-transform:uppercase;">Active</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:${G};">${activeSwaps}</p>
        </td>
        <td style="width:3%;background:${BG};"></td>
        <td style="width:32%;text-align:center;padding:16px 8px;background:#EFF6FF;border:1px solid #BFDBFE;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${GR};text-transform:uppercase;">This Week</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:${BL};">${swapsThisWeek}</p>
        </td>
        <td style="width:3%;background:${BG};"></td>
        <td style="width:32%;text-align:center;padding:16px 8px;background:#FFFBEB;border-radius:0 12px 12px 0;border:1px solid #FDE68A;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${GR};text-transform:uppercase;">Wallet</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:${AM};">${Number(walletBC).toLocaleString()}</p>
          <p style="margin:2px 0 0;font-size:10px;color:${GR};">BC</p>
        </td>
      </tr>
    </table>

    ${suggestions?.length > 0 ? `
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${DK};">🎯 Picks for you:</p>
    ${suggestions.slice(0, 3).map(l => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;background:${BG};border:1px solid ${BD};border-radius:10px;">
        <tr><td style="padding:12px 16px;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:${DK};">${l.title}</p>
          <p style="margin:0 0 6px;font-size:12px;color:${GR};">${l.locationState || 'Nigeria'} · ${Number(l.estimatedValue || 0).toLocaleString()} BC</p>
          <a href="${frontendUrl}/listing/${l.id || l._id}" style="font-size:12px;font-weight:700;color:${G};text-decoration:none;">View listing →</a>
        </td></tr>
      </table>`).join('')}
    <div style="text-align:center;margin:12px 0 20px;">
      <a href="${frontendUrl}/listings" style="font-size:13px;font-weight:700;color:${G};text-decoration:none;">See all listings →</a>
    </div>` : ''}

    <div style="text-align:center;">
      ${btn('💬 Go to My Swaps', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `${activeSwaps} active swaps · ${Number(walletBC).toLocaleString()} BC balance` });

  return { subject, html, text: `Afternoon: ${activeSwaps} active swaps. Visit ${frontendUrl}` };
};

const nightDigest = ({ user, daySummary, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const { completedToday = 0, newProposalsToday = 0, totalSwaps = 0, walletBC = 0, pendingCount = 0 } = daySummary;
  const subject = completedToday > 0
    ? `🌙 Evening, ${name}! ${completedToday} swap${completedToday > 1 ? 's' : ''} completed today 🎉`
    : `🌙 Evening, ${name} — your SwapNaija recap`;

  const tips = [
    'Traders who respond within 2 hours get 4× more accepted proposals.',
    'Add a detailed description to your listing — it builds buyer confidence.',
    'Verified accounts close swaps 3× faster. Verify for just 1,000 BC.',
    'Always inspect items when they arrive before confirming receipt. Safety first!',
    'Top up your wallet now so you\'re ready to pay escrow instantly.',
  ];
  const tip = tips[new Date().getDay() % tips.length];

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 24px;font-size:15px;color:${GR};line-height:1.7;">
      Here's your SwapNaija day in review.
      ${completedToday > 0
        ? `You completed <strong style="color:${G};">${completedToday} swap${completedToday > 1 ? 's' : ''}</strong> today — amazing work! 🎯`
        : `No completions today — but ${newProposalsToday} new proposal${newProposalsToday !== 1 ? 's' : ''} came in!`}
    </p>

    <div style="background:${DK};border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Today's Numbers</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;text-align:center;padding-bottom:16px;">
            <p style="margin:0;font-size:40px;font-weight:800;color:${G};">${completedToday}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">Completed</p>
          </td>
          <td style="width:50%;text-align:center;padding-bottom:16px;">
            <p style="margin:0;font-size:40px;font-weight:800;color:${AM};">${newProposalsToday}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">New Proposals</p>
          </td>
        </tr>
        <tr>
          <td style="width:50%;text-align:center;">
            <p style="margin:0;font-size:40px;font-weight:800;color:#60A5FA;">${totalSwaps}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">All-time Swaps</p>
          </td>
          <td style="width:50%;text-align:center;">
            <p style="margin:0;font-size:40px;font-weight:800;color:#fff;">${Number(walletBC).toLocaleString()}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">BC Balance</p>
          </td>
        </tr>
      </table>
    </div>

    ${pendingCount > 0 ? `
    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400E;">
        ⏰ <strong>${pendingCount} action${pendingCount > 1 ? 's' : ''}</strong> still pending —
        don't leave your swap partners waiting overnight!
      </p>
    </div>` : ''}

    <div style="background:${GL};border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${G};text-transform:uppercase;">Daily Tip</p>
      <p style="margin:0;font-size:13px;color:${DK};font-style:italic;">"${tip}"</p>
    </div>

    <div style="text-align:center;">
      ${btn('🔄 View All Swaps', `${frontendUrl}/swaps`)}
    </div>
    ${hr()}
    <p style="margin:0;font-size:12px;color:${GR};text-align:center;">Good night — SwapNaija runs 24/7 for you. 🌙</p>
  `, { preheader: `${completedToday} completed, ${pendingCount} pending — your evening recap` });

  return { subject, html, text: `Evening recap: ${completedToday} completed, ${pendingCount} pending. Visit ${frontendUrl}` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 17. WALLET TOPUP SUCCESS → user
// ═══════════════════════════════════════════════════════════════════════════════
const walletTopupSuccess = ({ user, amountKobo, newBalanceKobo, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const amountBC = bc(amountKobo);
  const balanceBC = bc(newBalanceKobo);
  const subject = `💳 ₦${Math.round(amountKobo / 100).toLocaleString()} added to your SwapNaija wallet!`;

  const html = base(`
    ${hi(name)}
    <p style="margin:4px 0 20px;font-size:15px;color:${GR};line-height:1.7;">
      Your Paystack payment was confirmed and your wallet has been credited.
    </p>

    <div style="background:${GL};border:1px solid #6EE7B7;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:13px;color:${GR};">Amount added</p>
      <p style="margin:0;font-size:40px;font-weight:900;color:${G};">+${amountBC}</p>
      <p style="margin:4px 0 16px;font-size:12px;color:${GR};">Barter Credits (1 BC = ₦1)</p>
      <div style="border-top:1px solid #6EE7B7;padding-top:12px;">
        <p style="margin:0;font-size:14px;color:${GR};">New wallet balance</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${DK};">${balanceBC}</p>
      </div>
    </div>

    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${DK};">What can you use BC for?</p>
    <ul style="margin:0 0 24px;padding-left:18px;font-size:13px;color:${GR};line-height:2.2;">
      <li>🔒 Pay escrow deposits on high-value swaps</li>
      <li>⚖️ Bridge value gaps with top-up payments</li>
      <li>✅ Get your account verified (1,000 BC)</li>
      <li>🚀 Boost your listings to reach more traders</li>
    </ul>

    <div style="text-align:center;">
      ${btn('🔄 Start Swapping', `${frontendUrl}/listings`)}
    </div>
  `, { preheader: `${amountBC} added to your wallet! Your new balance is ${balanceBC}.` });

  return { subject, html, text: `${amountBC} added to your SwapNaija wallet. New balance: ${balanceBC}. Start swapping at ${frontendUrl}/listings` };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 18. ESCROW REMINDER → user who hasn't paid yet
// ═══════════════════════════════════════════════════════════════════════════════
const escrowReminder = ({ user, otherUser, swap, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'there';
  const subject = `⏰ Reminder: Pay your escrow deposit to activate the swap`;
  const depositBC = bc(swap.escrowDepositKobo || 0);

  const html = base(`
    ${hi(name)}
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#92400E;">⏳ Action required</p>
      <p style="margin:0;font-size:13px;color:#78350F;line-height:1.7;">
        <strong>${otherUser?.fullName || 'Your swap partner'}</strong> has already paid their escrow deposit.
        Pay yours now to activate the swap and protect both parties before shipping.
      </p>
    </div>

    ${swapSummary(swap, 'receiver')}

    <div style="background:${BG};border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${DK};">Your escrow deposit</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${finRow('Deposit required', depositBC, RD)}
        ${finRow('Platform fee (2%)', bc(Math.round((swap.escrowDepositKobo || 0) * 0.02)))}
        ${finRow('Refunded on completion', bc(Math.round((swap.escrowDepositKobo || 0) * 0.98)), G)}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:13px;color:${GR};line-height:1.7;">
      Escrow keeps both parties honest — if anything goes wrong with the delivery, our dispute team will fairly resolve it.
      Your deposit is <strong>fully refunded</strong> (minus 2% fee) when the swap completes.
    </p>

    <div style="text-align:center;margin:24px 0 8px;">
      ${btn('🔒 Pay Escrow Now', `${frontendUrl}/swaps`)}
    </div>
  `, { preheader: `${otherUser?.fullName} already paid. Pay your ${depositBC} escrow deposit to activate the swap.` });

  return { subject, html, text: `Reminder: Pay your ${depositBC} escrow deposit. ${otherUser?.fullName} already paid. Go to ${frontendUrl}/swaps` };
};

// ─── Inject frontend URL ──────────────────────────────────────────────────────
const injectUrl = (tpl, frontendUrl) => ({
  ...tpl,
  html: tpl.html.replace(/%%FRONTEND_URL%%/g, frontendUrl),
});

module.exports = {
  swapProposed, swapAccepted, swapDeclined, swapCancelled,
  shipmentSubmitted,
  escrowDepositNeeded, escrowActivated,
  onePartyConfirmed, swapCompleted,
  topUpRequired, topUpPaid,
  disputeRaised, disputeRuled,
  walletTopupSuccess, escrowReminder,
  welcomeEmail,
  morningDigest, afternoonDigest, nightDigest,
  injectUrl,
};
