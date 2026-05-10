/**
 * SwapNaija — Email Templates
 * All templates share the same base layout (header + footer).
 * Call template(data) to get { subject, html, text }.
 */

const BRAND = {
  green:      '#1D9E75',
  greenLight: '#E8F8F2',
  greenDark:  '#158A63',
  amber:      '#F59E0B',
  red:        '#EF4444',
  blue:       '#3B82F6',
  gray:       '#6B7280',
  dark:       '#111827',
  bg:         '#F9FAFB',
  card:       '#FFFFFF',
  border:     '#E5E7EB',
};

// ─── Base layout ──────────────────────────────────────────────────────────────
const base = (content, { preheader = '' } = {}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <title>SwapNaija</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};min-height:100vh;">
    <tr><td align="center" style="padding:24px 16px 48px;">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND.green};border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
            <a href="https://swapnaija.com" style="text-decoration:none;">
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">🔄 SwapNaija</span>
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:${BRAND.card};border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};padding:32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F3F4F6;border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:${BRAND.gray};">
              You're receiving this because you have a SwapNaija account.
            </p>
            <p style="margin:0;font-size:12px;color:${BRAND.gray};">
              <a href="%%FRONTEND_URL%%/settings?tab=notifications" style="color:${BRAND.green};text-decoration:none;">Manage email preferences</a>
              &nbsp;·&nbsp;
              <a href="%%FRONTEND_URL%%/settings?tab=notifications&unsubscribe=1" style="color:${BRAND.gray};text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const btn = (label, url, color = BRAND.green) =>
  `<a href="${url}" style="display:inline-block;background:${color};color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;letter-spacing:0.2px;">${label}</a>`;

const badge = (label, color = BRAND.green, bg = BRAND.greenLight) =>
  `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${label}</span>`;

const divider = () =>
  `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />`;

const swapCard = ({ initiatorListing, receiverListing, status }) => {
  const iTitle = initiatorListing?.title || 'Item';
  const rTitle = receiverListing?.title  || 'Item';
  const iVal   = initiatorListing?.estimatedValue ? `${Number(initiatorListing.estimatedValue).toLocaleString()} BC` : '';
  const rVal   = receiverListing?.estimatedValue  ? `${Number(receiverListing.estimatedValue).toLocaleString()} BC`  : '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.greenLight};border-radius:12px;margin:16px 0;">
      <tr>
        <td style="padding:16px;text-align:center;width:40%;">
          <p style="margin:0 0 4px;font-size:12px;color:${BRAND.gray};">Your offer</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${iTitle}</p>
          ${iVal ? `<p style="margin:4px 0 0;font-size:11px;color:${BRAND.green};">${iVal}</p>` : ''}
        </td>
        <td style="padding:16px;text-align:center;width:20%;">
          <span style="font-size:22px;">⇄</span>
        </td>
        <td style="padding:16px;text-align:center;width:40%;">
          <p style="margin:0 0 4px;font-size:12px;color:${BRAND.gray};">For</p>
          <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${rTitle}</p>
          ${rVal ? `<p style="margin:4px 0 0;font-size:${BRAND.green};">${rVal}</p>` : ''}
        </td>
      </tr>
    </table>
  `;
};

const greeting = (name) =>
  `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.dark};">Hey ${name || 'there'} 👋</h1>`;

// ─── Status colour ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  proposed:  BRAND.blue,
  accepted:  BRAND.green,
  meetup_set: BRAND.amber,
  in_escrow: BRAND.amber,
  completed: BRAND.green,
  cancelled: BRAND.gray,
  disputed:  BRAND.red,
};
const STATUS_LABEL = {
  proposed:  'Pending',
  accepted:  'Accepted',
  meetup_set:'Meetup Set',
  in_escrow: 'In Escrow',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed:  'Disputed',
};

// ─── 1. Swap Proposed (to receiver) ──────────────────────────────────────────
const swapProposed = ({ receiver, initiator, swap, frontendUrl }) => {
  const subject = `🔄 ${initiator.fullName || 'Someone'} wants to swap with you!`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(receiver.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      <strong style="color:${BRAND.dark};">${initiator.fullName || 'A user'}</strong> just sent you a swap proposal on SwapNaija.
      They want to trade — will you accept?
    </p>
    ${swapCard(swap)}
    ${swap.proposalNote ? `
      <div style="background:#FFFBEB;border-left:3px solid ${BRAND.amber};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:${BRAND.dark};">💬 <em>"${swap.proposalNote}"</em></p>
      </div>` : ''}
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Review the proposal and let them know. Don't keep them waiting — active traders get better matches!
    </p>
    <div style="text-align:center;margin-bottom:8px;">
      ${btn('👀 View Proposal', url)}
    </div>
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      Proposals expire after 7 days if not responded to.
    </p>
  `, { preheader: `${initiator.fullName} wants to swap with you on SwapNaija` });

  return { subject, html, text: `${initiator.fullName} wants to swap with you. View at ${url}` };
};

// ─── 2. Swap Accepted (to initiator) ─────────────────────────────────────────
const swapAccepted = ({ initiator, receiver, swap, frontendUrl }) => {
  const subject = `🎉 Your swap was accepted by ${receiver.fullName || 'the other party'}!`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(initiator.fullName?.split(' ')[0])}
    <p style="margin:0 0 8px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Great news! <strong style="color:${BRAND.dark};">${receiver.fullName || 'Your swap partner'}</strong> has
      <span style="color:${BRAND.green};font-weight:700;">accepted</span> your swap proposal.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Next steps: agree on a meetup or activate escrow to keep both parties protected.
    </p>
    ${swapCard(swap)}
    <div style="background:${BRAND.greenLight};border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.green};">What to do next:</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:${BRAND.dark};line-height:2;">
        <li>Set a meetup location and time</li>
        <li>Optionally activate escrow for added security</li>
        <li>Meet, swap, and confirm completion</li>
      </ol>
    </div>
    <div style="text-align:center;">
      ${btn('🚀 Continue the Swap', url)}
    </div>
  `, { preheader: `${receiver.fullName} accepted your swap! Time to take the next step.` });

  return { subject, html, text: `${receiver.fullName} accepted your swap. Continue at ${url}` };
};

// ─── 3. Swap Declined / Cancelled ────────────────────────────────────────────
const swapCancelled = ({ user, otherUser, swap, isDecline, frontendUrl }) => {
  const subject = isDecline
    ? `Your swap proposal was declined`
    : `Swap cancelled — your escrow is being refunded`;
  const url = `${frontendUrl}/listings`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      ${isDecline
        ? `<strong style="color:${BRAND.dark};">${otherUser?.fullName || 'The other user'}</strong> has declined your swap proposal. Don't be discouraged — there are thousands of items waiting to be swapped!`
        : `The swap between you and <strong style="color:${BRAND.dark};">${otherUser?.fullName || 'the other party'}</strong> was cancelled.`
      }
    </p>
    ${swap.escrowDepositKobo && (swap.initiatorDepositPaid || swap.receiverDepositPaid) ? `
      <div style="background:#FEF3C7;border:1px solid ${BRAND.amber};border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#92400E;">
          💰 <strong>Your escrow deposit has been refunded</strong> to your Barter Credits wallet.
        </p>
      </div>` : ''}
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Keep browsing — your perfect swap partner is out there. SwapNaija has 1,000+ active listings right now!
    </p>
    <div style="text-align:center;">
      ${btn('🔍 Browse Listings', url, BRAND.greenDark)}
    </div>
  `, { preheader: isDecline ? 'Your proposal was declined. Keep exploring!' : 'Swap cancelled. Escrow refunded.' });

  return { subject, html, text: subject };
};

// ─── 4. Meetup Set ────────────────────────────────────────────────────────────
const meetupSet = ({ user, otherUser, swap, frontendUrl }) => {
  const meetupDate = swap.meetupScheduled
    ? new Date(swap.meetupScheduled).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  const subject = `📍 Meetup scheduled — ${meetupDate}`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      A meetup has been set for your swap with
      <strong style="color:${BRAND.dark};">${otherUser?.fullName || 'your swap partner'}</strong>.
    </p>
    <div style="background:${BRAND.greenLight};border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:32px;vertical-align:top;padding-right:12px;font-size:20px;">📅</td>
          <td>
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">Date &amp; Time</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${meetupDate}</p>
          </td>
        </tr>
        ${swap.meetupLocation ? `
        <tr><td colspan="2" style="padding:12px 0 0;"></td></tr>
        <tr>
          <td style="width:32px;vertical-align:top;padding-right:12px;font-size:20px;">📍</td>
          <td>
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">Location</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${swap.meetupLocation}</p>
          </td>
        </tr>` : ''}
      </table>
    </div>
    <div style="background:#FEF9EE;border:1px solid #FDE68A;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#78350F;">
        ⚠️ <strong>Safety tip:</strong> Meet in a public place, bring a friend if possible, and verify items before confirming the swap.
      </p>
    </div>
    <div style="text-align:center;">
      ${btn('📋 View Swap Details', url)}
    </div>
  `, { preheader: `Meetup on ${meetupDate} — don't forget!` });

  return { subject, html, text: `Meetup set for ${meetupDate} at ${swap.meetupLocation || 'TBD'}. View at ${url}` };
};

// ─── 5. Escrow Deposit Paid (waiting on other party) ─────────────────────────
const escrowDepositNeeded = ({ user, payer, swap, frontendUrl }) => {
  const depositBC = ((swap.escrowDepositKobo || 0) / 100).toLocaleString();
  const subject = `⏳ ${payer.fullName} paid their escrow — your turn!`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      <strong style="color:${BRAND.dark};">${payer.fullName || 'Your swap partner'}</strong> has paid their
      escrow deposit of <strong style="color:${BRAND.green};">${depositBC} BC</strong>.
      Now it's your turn — pay yours to activate the escrow and lock in the swap!
    </p>
    <div style="background:${BRAND.greenLight};border-radius:12px;padding:18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.gray};">Your deposit required</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:${BRAND.green};">${depositBC} BC</p>
      <p style="margin:4px 0 0;font-size:12px;color:${BRAND.gray};">Refunded (minus 2% fee) when the swap completes</p>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      ${btn('💳 Pay Escrow Now', url)}
    </div>
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      Need Barter Credits? <a href="${frontendUrl}/wallet" style="color:${BRAND.green};text-decoration:none;">Top up your wallet →</a>
    </p>
  `, { preheader: `${payer.fullName} paid escrow — activate yours to continue the swap!` });

  return { subject, html, text: `${payer.fullName} paid their escrow. Pay yours (${depositBC} BC) at ${url}` };
};

// ─── 6. Escrow Active (both paid) ────────────────────────────────────────────
const escrowActivated = ({ user, otherUser, swap, frontendUrl }) => {
  const subject = `🔒 Escrow is LIVE — your swap is protected!`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Both parties have paid the escrow deposit. Your swap with
      <strong style="color:${BRAND.dark};">${otherUser?.fullName || 'your partner'}</strong> is now
      <strong style="color:${BRAND.green};">secured by SwapNaija Escrow</strong> 🛡️
    </p>
    <div style="background:${BRAND.greenLight};border:1px solid ${BRAND.green};border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${BRAND.green};">How escrow protects you:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:${BRAND.dark};line-height:2.2;">
        <li>Deposits held safely until both parties confirm</li>
        <li>If either party backs out, you get your deposit back</li>
        <li>Only a 2% platform fee is charged on completion</li>
      </ul>
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Next step: schedule a meetup and complete your swap. Once both of you confirm,
      your deposits are refunded and your swap count goes up! 🎯
    </p>
    <div style="text-align:center;">
      ${btn('📍 Set Meetup', url)}
    </div>
  `, { preheader: 'Escrow is active — your swap is now fully protected!' });

  return { subject, html, text: `Escrow is live for your swap with ${otherUser?.fullName}. Set a meetup at ${url}` };
};

// ─── 7. Swap Completed ────────────────────────────────────────────────────────
const swapCompleted = ({ user, otherUser, swap, refundBC, frontendUrl }) => {
  const subject = `🎊 Swap completed! Leave a review for ${otherUser?.fullName || 'your partner'}`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:60px;line-height:1;">🎊</div>
      <h2 style="margin:12px 0 4px;font-size:22px;font-weight:800;color:${BRAND.dark};">Swap Complete!</h2>
      <p style="margin:0;font-size:15px;color:${BRAND.gray};">
        Your swap with <strong style="color:${BRAND.dark};">${otherUser?.fullName || 'your partner'}</strong> is done!
      </p>
    </div>
    ${refundBC ? `
    <div style="background:${BRAND.greenLight};border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:${BRAND.gray};">Escrow refunded to your wallet</p>
      <p style="margin:0;font-size:28px;font-weight:800;color:${BRAND.green};">+${refundBC} BC</p>
    </div>` : ''}
    <p style="margin:0 0 8px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Help others in the community by leaving an honest review for ${otherUser?.fullName || 'your partner'}.
      Reviews build trust and keep SwapNaija safe for everyone.
    </p>
    <div style="text-align:center;margin:24px 0;">
      ${btn('⭐ Leave a Review', url)}
    </div>
    ${divider()}
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.gray};text-align:center;">
      Keep the momentum going — browse more listings!
    </p>
    <div style="text-align:center;">
      ${btn('🔍 Browse Listings', `${frontendUrl}/listings`, BRAND.gray)}
    </div>
  `, { preheader: `Congratulations! Your swap is complete. ${refundBC ? `${refundBC} BC refunded.` : ''}` });

  return { subject, html, text: `Swap completed with ${otherUser?.fullName}. Leave a review at ${url}` };
};

// ─── 8. Dispute Raised ────────────────────────────────────────────────────────
const disputeRaised = ({ user, raiser, swap, isRaiser, frontendUrl }) => {
  const subject = isRaiser
    ? `🚨 Your dispute has been submitted`
    : `🚨 A dispute has been raised on your swap`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#991B1B;">⚠️ Dispute in Progress</p>
      <p style="margin:0;font-size:13px;color:#7F1D1D;line-height:1.6;">
        ${isRaiser
          ? `Your dispute has been received. Our team will review it within 24–48 hours.`
          : `<strong>${raiser?.fullName || 'Your swap partner'}</strong> has raised a dispute on this swap. Our team has been notified and will investigate.`
        }
      </p>
    </div>
    ${swap.disputeReason ? `
    <div style="background:#F9FAFB;border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">Reason provided</p>
      <p style="margin:0;font-size:13px;color:${BRAND.dark};">"${swap.disputeReason}"</p>
    </div>` : ''}
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      ${isRaiser
        ? `Keep your items safe and don't transfer anything until the dispute is resolved. Our team may contact you for more information.`
        : `Please do not proceed with the swap until the dispute is resolved. You may be contacted by our team for your side of the story.`
      }
    </p>
    <div style="text-align:center;">
      ${btn('📋 View Swap', url, BRAND.red)}
    </div>
  `, { preheader: isRaiser ? 'Dispute submitted — our team is on it' : `${raiser?.fullName} raised a dispute on your swap` });

  return { subject, html, text: subject };
};

// ─── 9. Top-up Required ──────────────────────────────────────────────────────
const topUpRequired = ({ user, otherUser, swap, frontendUrl }) => {
  const topUpBC = ((swap.topUpAmountKobo || 0) / 100).toLocaleString();
  const subject = `💸 You need to pay a ${topUpBC} BC value-gap top-up`;
  const url = `${frontendUrl}/swaps`;
  const html = base(`
    ${greeting(user.fullName?.split(' ')[0])}
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Your swap with <strong style="color:${BRAND.dark};">${otherUser?.fullName || 'your partner'}</strong> has a
      value gap. To proceed, you need to pay a top-up to make the swap fair.
    </p>
    <div style="background:#FEF9EE;border:1px solid #FDE68A;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.gray};">Value-gap top-up required</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:${BRAND.amber};">${topUpBC} BC</p>
      <p style="margin:4px 0 0;font-size:12px;color:${BRAND.gray};">Released to the other party on swap completion</p>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      ${btn('💸 Pay Top-up', url, BRAND.amber)}
    </div>
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      Need more Barter Credits? <a href="${frontendUrl}/wallet" style="color:${BRAND.green};text-decoration:none;">Top up your wallet →</a>
    </p>
  `, { preheader: `${topUpBC} BC top-up needed to continue your swap with ${otherUser?.fullName}` });

  return { subject, html, text: `You need to pay ${topUpBC} BC top-up. Visit ${url}` };
};

// ─── 10. Morning Digest ───────────────────────────────────────────────────────
const morningDigest = ({ user, pendingActions, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'Trader';
  const { pendingProposals = [], awaitingEscrow = [], upcomingMeetups = [], awaitingConfirm = [] } = pendingActions;
  const totalActions = pendingProposals.length + awaitingEscrow.length + awaitingConfirm.length;

  const subject = totalActions > 0
    ? `☀️ Good morning ${name}! You have ${totalActions} action${totalActions > 1 ? 's' : ''} waiting`
    : `☀️ Good morning ${name}! Ready to swap today?`;

  const actionItem = (emoji, title, desc, url) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;font-size:20px;vertical-align:middle;">${emoji}</td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${title}</p>
              <p style="margin:2px 0 0;font-size:12px;color:${BRAND.gray};">${desc}</p>
            </td>
            <td style="width:80px;text-align:right;vertical-align:middle;">
              <a href="${url}" style="font-size:12px;font-weight:700;color:${BRAND.green};text-decoration:none;">Act Now →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const hasActions = totalActions > 0;
  const swapsUrl = `${frontendUrl}/swaps`;

  const html = base(`
    ${greeting(name)}
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      ${hasActions
        ? `You've got <strong style="color:${BRAND.green};">${totalActions} item${totalActions > 1 ? 's' : ''} needing your attention</strong> today. Let's get them sorted!`
        : `No urgent actions today — but there are fresh listings waiting to be discovered. Happy swapping! 🌟`
      }
    </p>

    ${hasActions ? `
    <div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <div style="background:${BRAND.green};padding:12px 16px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">⚡ Your Action Items</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 16px;">
        ${pendingProposals.slice(0, 3).map(s =>
          actionItem('📨', `Proposal from ${s.initiatorId?.fullName || 'Someone'}`, `Wants to swap: ${s.initiatorListing?.title || 'an item'}`, swapsUrl)
        ).join('')}
        ${awaitingEscrow.slice(0, 2).map(s =>
          actionItem('💳', `Pay escrow for swap with ${s.otherUser?.fullName || 'partner'}`, `${((s.escrowDepositKobo || 0) / 100).toLocaleString()} BC required`, swapsUrl)
        ).join('')}
        ${awaitingConfirm.slice(0, 2).map(s =>
          actionItem('✅', `Confirm completion with ${s.otherUser?.fullName || 'partner'}`, `They already confirmed — you're the last step!`, swapsUrl)
        ).join('')}
      </table>
    </div>` : ''}

    ${upcomingMeetups.length > 0 ? `
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1D4ED8;">📅 Upcoming Meetups</p>
      ${upcomingMeetups.slice(0, 2).map(s => `
        <p style="margin:0 0 4px;font-size:13px;color:${BRAND.dark};">
          • <strong>${s.otherUser?.fullName || 'Partner'}</strong> —
          ${new Date(s.meetupScheduled).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          ${s.meetupLocation ? `@ ${s.meetupLocation}` : ''}
        </p>
      `).join('')}
    </div>` : ''}

    <div style="text-align:center;margin:24px 0;">
      ${btn('🚀 Open SwapNaija', frontendUrl)}
    </div>
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      💡 <strong>Tip:</strong> Listings with photos get <strong>3× more swap proposals</strong>.
      <a href="${frontendUrl}/create-listing" style="color:${BRAND.green};text-decoration:none;">Add a listing →</a>
    </p>
  `, { preheader: hasActions ? `${totalActions} actions waiting for you today!` : 'Good morning — start your day with SwapNaija' });

  return { subject, html, text: `Good morning ${name}! ${totalActions} actions waiting. Visit ${frontendUrl}` };
};

// ─── 11. Afternoon Digest ─────────────────────────────────────────────────────
const afternoonDigest = ({ user, stats, suggestions, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'Trader';
  const { swapsThisWeek = 0, activeSwaps = 0, walletBC = 0 } = stats;
  const subject = `🌤️ Afternoon check-in, ${name} — keep the momentum going!`;

  const suggCard = (listing) => listing ? `
    <table cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin-bottom:12px;width:100%;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:${BRAND.dark};">${listing.title}</p>
          <p style="margin:0 0 6px;font-size:12px;color:${BRAND.gray};">${listing.locationState || 'Nigeria'} · ${Number(listing.estimatedValue || 0).toLocaleString()} BC</p>
          <a href="${frontendUrl}/listings/${listing.id || listing._id}" style="font-size:12px;font-weight:700;color:${BRAND.green};text-decoration:none;">View listing →</a>
        </td>
      </tr>
    </table>` : '';

  const html = base(`
    ${greeting(name)}
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Here's a quick midday check-in on your SwapNaija activity.
      ${activeSwaps > 0 ? `You have <strong style="color:${BRAND.green};">${activeSwaps} active swap${activeSwaps > 1 ? 's' : ''}</strong> in progress.` : 'No active swaps right now — time to find something to trade!'}
    </p>

    <!-- Stats row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:33%;text-align:center;padding:16px;background:${BRAND.greenLight};border-radius:12px 0 0 12px;border:1px solid #BBF7D0;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">Active Swaps</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:${BRAND.green};">${activeSwaps}</p>
        </td>
        <td style="width:4px;background:${BRAND.bg};"></td>
        <td style="width:33%;text-align:center;padding:16px;background:#EFF6FF;border:1px solid #BFDBFE;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">This Week</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#3B82F6;">${swapsThisWeek}</p>
        </td>
        <td style="width:4px;background:${BRAND.bg};"></td>
        <td style="width:33%;text-align:center;padding:16px;background:#FFFBEB;border-radius:0 12px 12px 0;border:1px solid #FDE68A;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${BRAND.gray};text-transform:uppercase;">Wallet (BC)</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:${BRAND.amber};">${Number(walletBC).toLocaleString()}</p>
        </td>
      </tr>
    </table>

    ${suggestions?.length > 0 ? `
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${BRAND.dark};">🎯 Listings you might like:</p>
    ${suggestions.slice(0, 3).map(suggCard).join('')}
    <div style="text-align:center;margin:16px 0 24px;">
      <a href="${frontendUrl}/listings" style="font-size:13px;font-weight:700;color:${BRAND.green};text-decoration:none;">See all listings →</a>
    </div>` : ''}

    <div style="text-align:center;margin-bottom:8px;">
      ${btn('💬 Check Swaps', `${frontendUrl}/swaps`)}
    </div>
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      🔥 <strong>Verified accounts</strong> get 40% more proposals.
      <a href="${frontendUrl}/wallet" style="color:${BRAND.green};text-decoration:none;">Verify for 1,000 BC →</a>
    </p>
  `, { preheader: `${activeSwaps} active swap${activeSwaps !== 1 ? 's' : ''} · ${Number(walletBC).toLocaleString()} BC wallet balance` });

  return { subject, html, text: `Afternoon update: ${activeSwaps} active swaps. Visit ${frontendUrl}` };
};

// ─── 12. Night Digest ─────────────────────────────────────────────────────────
const nightDigest = ({ user, daySummary, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'Trader';
  const {
    completedToday = 0,
    newProposalsToday = 0,
    totalSwaps = 0,
    walletBC = 0,
    pendingCount = 0,
  } = daySummary;

  const subject = completedToday > 0
    ? `🌙 Evening, ${name}! ${completedToday} swap${completedToday > 1 ? 's' : ''} completed today 🎉`
    : pendingCount > 0
      ? `🌙 Evening, ${name} — ${pendingCount} swap${pendingCount > 1 ? 's' : ''} still need your attention`
      : `🌙 Good evening, ${name}! See what's new on SwapNaija`;

  const motivational = [
    'Every trade builds your reputation. Keep going!',
    'The best traders are consistent. Check in daily for the best deals.',
    'Your next great swap is just one listing away!',
    'SwapNaija community traders complete 3× more deals when they log in daily.',
    'Top traders list regularly and respond quickly. Stay active!',
  ];
  const tip = motivational[Math.floor(Math.random() * motivational.length)];

  const html = base(`
    ${greeting(name)}
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Here's your SwapNaija recap for today.
      ${completedToday > 0
        ? `Amazing — you completed <strong style="color:${BRAND.green};">${completedToday} swap${completedToday > 1 ? 's' : ''}</strong> today!`
        : `No swaps completed today — but tomorrow is a fresh start!`
      }
    </p>

    <!-- Today summary -->
    <div style="background:${BRAND.dark};border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Today's Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;text-align:center;padding-bottom:16px;">
            <p style="margin:0;font-size:36px;font-weight:800;color:${BRAND.green};">${completedToday}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">Completed</p>
          </td>
          <td style="width:50%;text-align:center;padding-bottom:16px;">
            <p style="margin:0;font-size:36px;font-weight:800;color:${BRAND.amber};">${newProposalsToday}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">New Proposals</p>
          </td>
        </tr>
        <tr>
          <td style="width:50%;text-align:center;">
            <p style="margin:0;font-size:36px;font-weight:800;color:#60A5FA;">${totalSwaps}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">Total Swaps</p>
          </td>
          <td style="width:50%;text-align:center;">
            <p style="margin:0;font-size:36px;font-weight:800;color:rgba(255,255,255,0.9);">${Number(walletBC).toLocaleString()}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">BC Balance</p>
          </td>
        </tr>
      </table>
    </div>

    ${pendingCount > 0 ? `
    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400E;">
        ⏰ You still have <strong>${pendingCount} pending action${pendingCount > 1 ? 's' : ''}</strong> to take care of.
        Don't let your swap partners wait too long!
      </p>
    </div>` : ''}

    <div style="background:${BRAND.greenLight};border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:${BRAND.green};font-style:italic;">💡 "${tip}"</p>
    </div>

    <div style="text-align:center;">
      ${btn('🔄 View Your Swaps', `${frontendUrl}/swaps`)}
    </div>
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.gray};text-align:center;">
      Good night! SwapNaija is always open — your perfect swap is waiting.
    </p>
  `, { preheader: `Your evening recap — ${completedToday} completed, ${pendingCount} pending` });

  return { subject, html, text: `Evening recap: ${completedToday} completed today. Visit ${frontendUrl}` };
};

// ─── 13. Welcome Email ────────────────────────────────────────────────────────
const welcomeEmail = ({ user, frontendUrl }) => {
  const name = user.fullName?.split(' ')[0] || 'Trader';
  const subject = `🎉 Welcome to SwapNaija, ${name}! Let's start swapping`;
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:56px;line-height:1;">🔄</div>
      <h1 style="margin:12px 0 4px;font-size:24px;font-weight:800;color:${BRAND.dark};">Welcome to SwapNaija!</h1>
      <p style="margin:0;font-size:15px;color:${BRAND.gray};">Nigeria's #1 peer-to-peer barter marketplace</p>
    </div>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Hey <strong style="color:${BRAND.dark};">${name}</strong>! You're now part of a growing community of traders
      across Nigeria exchanging goods and services without spending cash.
    </p>
    <div style="margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${BRAND.dark};">Get started in 3 steps:</p>
      ${[
        ['1️⃣', 'List an item or service', 'Tell the community what you have to offer', `${frontendUrl}/create-listing`],
        ['2️⃣', 'Browse listings', 'Discover what others want to swap', `${frontendUrl}/listings`],
        ['3️⃣', 'Propose a swap', 'Send a proposal and start trading!', `${frontendUrl}/listings`],
      ].map(([emoji, title, desc, link]) => `
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;background:${BRAND.bg};border-radius:12px;padding:14px 16px;">
          <span style="font-size:20px;margin-right:12px;">${emoji}</span>
          <div>
            <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.dark};">${title}</p>
            <p style="margin:2px 0 4px;font-size:12px;color:${BRAND.gray};">${desc}</p>
            <a href="${link}" style="font-size:12px;font-weight:700;color:${BRAND.green};text-decoration:none;">Get started →</a>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="text-align:center;">
      ${btn('🚀 Start Swapping', frontendUrl)}
    </div>
  `, { preheader: `Welcome to SwapNaija, ${name}! Your barter journey starts here.` });

  return { subject, html, text: `Welcome to SwapNaija, ${name}! Start at ${frontendUrl}` };
};

// ─── Inject frontend URL into html ───────────────────────────────────────────
const injectUrl = (tpl, frontendUrl) => ({
  ...tpl,
  html: tpl.html.replace(/%%FRONTEND_URL%%/g, frontendUrl),
});

module.exports = {
  swapProposed,
  swapAccepted,
  swapCancelled,
  meetupSet,
  escrowDepositNeeded,
  escrowActivated,
  swapCompleted,
  disputeRaised,
  topUpRequired,
  morningDigest,
  afternoonDigest,
  nightDigest,
  welcomeEmail,
  injectUrl,
};
