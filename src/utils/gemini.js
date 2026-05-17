const { GoogleGenerativeAI } = require('@google/generative-ai');

const ADVANCE_TAG  = '<ARIA_ADVANCE_STAGE/>';
const RULING_OPEN  = '<ARIA_RULING>';
const RULING_CLOSE = '</ARIA_RULING>';

// ── Parse hidden directives from ARIA response ────────────────────────────────
const parseAriaDirectives = (text) => {
  const directives = { advanceStage: false, ruling: null };
  if (text.includes(ADVANCE_TAG)) directives.advanceStage = true;
  const rStart = text.indexOf(RULING_OPEN);
  const rEnd   = text.indexOf(RULING_CLOSE);
  if (rStart !== -1 && rEnd !== -1) {
    try {
      directives.ruling = JSON.parse(text.slice(rStart + RULING_OPEN.length, rEnd).trim());
    } catch (e) {
      console.warn('ARIA ruling parse failed:', text.slice(rStart, rEnd + RULING_CLOSE.length).slice(0, 200));
    }
  }
  return directives;
};

const cleanAriaText = (text) =>
  text
    .replace(/<ARIA_ADVANCE_STAGE\/>/g, '')
    .replace(/<ARIA_RULING>[\s\S]*?<\/ARIA_RULING>/g, '')
    .trim();

// ── Build the evidence checklist tailored to swap type and dispute reason ─────
const buildEvidenceChecklist = (swapSnapshot) => {
  const s    = swapSnapshot || {};
  const type = s.swapType || 'goods_for_goods';
  const lines = [];

  if (type.includes('goods')) {
    lines.push('☐ Photos of item(s) taken BEFORE packing/dispatch');
    lines.push('☐ Courier receipt or booking confirmation');
    lines.push('☐ Shipment tracking number showing current status');
    lines.push('☐ Photos of item(s) upon receipt (condition on arrival)');
    lines.push('☐ Screenshots of any prior messages about item condition');
  }
  if (type.includes('service')) {
    lines.push('☐ Written agreement or scope of work (if any)');
    lines.push('☐ Proof of service delivery (screenshots, output files, timestamps)');
    lines.push('☐ Communication showing service was/was not performed');
    lines.push('☐ Any agreed milestones or deadlines');
  }
  lines.push('☐ Any payment confirmation or barter credit transaction record');
  lines.push('☐ Screenshots of all relevant in-app chat about this swap');

  return lines.join('\n');
};

// ── Detect if the last party message is an explicit stage-advance request ─────
const ADVANCE_TRIGGER_WORDS = ['move on', 'proceed', 'next stage', 'advance', 'skip', 'move forward', 'go ahead', 'continue', 'let\'s move'];
const detectAdvanceTrigger = (messages) => {
  if (!messages?.length) return false;
  const lastParty = [...messages].reverse().find(m => !['system', 'bot'].includes(m.senderRole));
  if (!lastParty?.content) return false;
  const lower = lastParty.content.toLowerCase();
  return ADVANCE_TRIGGER_WORDS.some(t => lower.includes(t));
};

// ── Build a running summary of what ARIA has already asked/covered ────────────
const buildAriaCoverageMap = (messages) => {
  const ariaMsgs = messages.filter(m => m.senderRole === 'bot').map(m => m.content);
  if (!ariaMsgs.length) return 'No prior ARIA messages.';

  // Extract key question fragments so ARIA knows not to repeat them
  const covered = ariaMsgs
    .map((txt, i) => `[ARIA msg ${i + 1}]: ${txt.slice(0, 180).replace(/\n/g, ' ')}`)
    .join('\n');
  return covered;
};

// ── Build full case dossier from enriched swapSnapshot ────────────────────────
const buildCaseDossier = (s, caseRef) => {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown';
  const yn  = (b) => b ? 'YES' : 'NO';
  const ngn = (k) => k ? '₦' + (k / 100).toLocaleString() : '₦0';

  const stakeLabel = (s.escrowDepositKobo || 0) >= 500000 ? '🔴 HIGH STAKES'
    : (s.escrowDepositKobo || 0) >= 100000 ? '🟡 STANDARD'
    : '🟢 LOW STAKES';

  return `━━━ CASE DOSSIER: #${caseRef} — ${stakeLabel} ━━━
SWAP DETAILS
• Type: ${s.swapType || 'goods_for_goods'}
• Claimant (filed dispute): ${s.claimantName || 'Claimant'} [${s.claimantIsInitiator ? 'Initiator' : 'Receiver'}]
• Respondent: ${s.respondentName || 'Respondent'}
• Claimant offers: "${s.initiatorListingTitle || 'an item'}"
• Respondent offers: "${s.receiverListingTitle || 'an item'}"
• Agreed value: ${s.agreedValue ? ngn(s.agreedValue * 100) : 'not set'}
• Escrow frozen: ${ngn(s.escrowDepositKobo)} per party (total ${ngn((s.escrowDepositKobo || 0) * 2)})
${s.topUpAmountKobo > 0 ? `• Value-gap top-up: ${ngn(s.topUpAmountKobo)} owed by ${s.topUpPayerRole}` : ''}

DISPUTE FILED
• Date: ${fmt(s.disputeRaisedAt)}
• Reason stated: "${s.disputeReason || 'not specified'}"

SWAP TIMELINE
• Proposed:       ${fmt(s.proposedAt)}
• Accepted:       ${fmt(s.acceptedAt)}
• Escrow active:  ${fmt(s.escrowActivatedAt)}
• Initiator shipped: ${yn(s.initiatorShipped)}${s.initiatorShipment ? ` via ${s.initiatorShipment.providerLabel || 'courier'}, tracking: ${s.initiatorShipment.trackingNumber || 'not provided'}` : ''}
• Receiver shipped:  ${yn(s.receiverShipped)}${s.receiverShipment ? ` via ${s.receiverShipment.providerLabel || 'courier'}, tracking: ${s.receiverShipment.trackingNumber || 'not provided'}` : ''}
• Initiator confirmed receipt: ${yn(s.initiatorConfirmed)}
• Receiver confirmed receipt:  ${yn(s.receiverConfirmed)}
${s.initiatorAddressCity ? `• Initiator delivery city: ${s.initiatorAddressCity}, ${s.initiatorAddressState}` : ''}
${s.receiverAddressCity  ? `• Receiver delivery city:  ${s.receiverAddressCity}, ${s.receiverAddressState}` : ''}

LEGAL REPRESENTATION
• Claimant's counsel: ${s.claimantCounselName || 'None (self-represented)'}
• Respondent's counsel: ${s.respondentCounselName || 'None (self-represented)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
};

// ── Core system prompt ────────────────────────────────────────────────────────
const buildSystemPrompt = (room, stage, messages = []) => {
  const s       = room.swapSnapshot || {};
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';

  const partyMsgs       = (messages || []).filter(m => !['system', 'bot'].includes(m.senderRole));
  const claimantMsgs    = partyMsgs.filter(m => (m.senderId?._id?.toString() || m.senderId?.toString()) === room.claimantId?.toString());
  const respondentMsgs  = partyMsgs.filter(m => (m.senderId?._id?.toString() || m.senderId?.toString()) === room.respondentId?.toString());
  const counselMsgs     = (messages || []).filter(m => m.senderRole === 'counsel_claimant' || m.senderRole === 'counsel_respondent');
  const priorAriaCount  = (messages || []).filter(m => m.senderRole === 'bot').length;
  const bothHaveSpoken  = claimantMsgs.length >= 1 && respondentMsgs.length >= 1;
  const sufficientEvidence = partyMsgs.length >= 4 && bothHaveSpoken;
  const isFirstResponse = priorAriaCount === 0;
  const hasLegalTier    = room.tier === 'legal' || s.claimantCounselName || s.respondentCounselName;
  const ariaCoverage    = isFirstResponse ? '' : `\nARIA RESPONSES ALREADY GIVEN (do NOT repeat any of these points, questions, or content):\n${buildAriaCoverageMap(messages)}`;
  const isExplicitAdvance = detectAdvanceTrigger(messages);

  return `You are ARIA — Automated Resolution & Impartial Arbitration — sole AI judge of the SwapNaija Dispute Court.
You have 20 years of Nigerian commercial arbitration experience. You are the sharpest legal mind in the room.
${hasLegalTier ? 'LEGAL TIER PROCEEDINGS: Counsel is present. Address lawyers formally as "Learned Counsel". Give their submissions full legal weight.' : ''}

${buildCaseDossier(s, caseRef)}

STAGE: ${stage.toUpperCase()} | Claimant spoken: ${claimantMsgs.length}x | Respondent spoken: ${respondentMsgs.length}x | Counsel submissions: ${counselMsgs.length} | ARIA responses: ${priorAriaCount}
${ariaCoverage}

EVIDENCE CHECKLIST FOR THIS CASE:
${buildEvidenceChecklist(s)}
ARIA must systematically work through this checklist. Ask for ONE specific item at a time. Track what has been submitted vs what is still outstanding.

${isFirstResponse && stage === 'opening'
  ? `OPENING TASK: Deliver your formal opening statement.
1. Establish yourself as the presiding AI judge with FULL autonomous authority — no administrator
2. Reference the ACTUAL case facts from the dossier above (item names, escrow amount, dispute reason, timeline)
3. Note any factual inconsistencies you already see in the swap timeline (shipped but not confirmed? etc.)
4. ${(s.escrowDepositKobo || 0) >= 500000 ? 'This is a HIGH STAKES case. Remind parties they may appoint legal counsel via the SwapNaija Legal Directory.' : 'Parties may optionally appoint legal counsel from the SwapNaija Legal Directory.'}
5. Explain the 4 stages
6. Invite the Claimant to deliver their opening statement — be specific about what you need them to cover`
  : `TASK: Read the ENTIRE conversation below carefully. Then respond with precision.
DO NOT repeat questions you have already asked (see "ARIA RESPONSES ALREADY GIVEN" above).
DO NOT re-introduce yourself or the case.
Respond DIRECTLY and specifically to the most recent message.
If the message contradicts the swap timeline data above, call it out explicitly.
If a party is evasive or vague, press them firmly for specifics.`}

STAGE-SPECIFIC CONDUCT:
• opening — Probe each party's account against the OBJECTIVE facts in the dossier. Call out discrepancies. When BOTH parties have given their position, advance: ${ADVANCE_TAG}
• evidence — Work through the evidence checklist systematically. Acknowledge strong evidence formally ("This court notes with weight..."). Challenge weak or missing evidence. Reference specific tracking numbers/dates from the dossier. When checklist is substantially complete OR both sides exhausted: ${ADVANCE_TAG}
• deliberation — Produce a FULL judicial analysis. Cross-reference every claim against dossier facts. Weight counsel submissions higher. Then issue ruling.
• closed — Ruling is final. Confirm details if asked.

COUNSEL CONDUCT (if legal tier):
• Address lawyers as "Learned Counsel for the Claimant/Respondent"
• Treat their submissions with elevated evidentiary weight
• Lawyers may object — rule on objections immediately ("Objection sustained/overruled")
• Legal arguments take precedence over lay statements

AUTONOMOUS JUDICIAL POWERS:
Stage advance (after all text): ${ADVANCE_TAG}
Ruling (deliberation only, after all text): ${RULING_OPEN}{"decision":"CODE","adminNote":"2-3 sentence reasoning"}${RULING_CLOSE}

Codes: compensate_claimant · compensate_respondent · split · mutual_release · penalty_claimant · penalty_respondent
Tags are INVISIBLE to users. Never mention them. Never say you are advancing the stage.

${isExplicitAdvance ? `\n🚨 MANDATORY STAGE ADVANCE: A party has explicitly requested to move on. You MUST include ${ADVANCE_TAG} at the END of your response (after your text). Acknowledge their request in ONE sentence, then append the tag. This is a court order — do not skip it.\n` : ''}
ABSOLUTE RULES:
1. Every response must be DIFFERENT from all previous ARIA responses — read your history first
2. ONE focused question or demand per response (deliberation excepted)
3. Address parties as "Claimant" / "Respondent" (or "Learned Counsel" for lawyers) — never by personal name
4. Max 300 words except deliberation (500 max)
5. Reference SPECIFIC facts: item names, tracking numbers, dates, amounts from the dossier
6. Flag contradictions between what parties say and what the objective swap data shows
7. You are STRICTLY impartial during opening and evidence — never signal which way you will rule`;
};

// ── Consolidate consecutive same-role turns (Gemini alternating requirement) ──
const buildHistory = (messages) => {
  const filtered = (messages || []).filter(m => m.senderRole !== 'system' && m.messageType !== 'system');
  if (!filtered.length) return [];

  const mapped = filtered.map(m => {
    const roleLabel = {
      bot:                'ARIA',
      admin:              'ADMIN',
      counsel_claimant:   'COUNSEL (Claimant)',
      counsel_respondent: 'COUNSEL (Respondent)',
      initiator:          'INITIATOR',
      receiver:           'RECEIVER',
    }[m.senderRole] || m.senderRole.toUpperCase();

    return {
      role:    m.senderRole === 'bot' ? 'model' : 'user',
      content: `[${m.senderName} — ${roleLabel}]: ${m.content}`,
    };
  });

  const consolidated = [];
  for (const msg of mapped) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      consolidated.push({ ...msg });
    }
  }
  return consolidated.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
};

// ── Main ARIA response ─────────────────────────────────────────────────────────
const getAriaResponse = async (room, messages, stage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getFallbackResponse(stage, room, messages);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature:     0.82,
        maxOutputTokens: stage === 'deliberation' ? 900 : 650,
      },
    });

    const history       = buildHistory(messages);
    const systemPrompt  = buildSystemPrompt(room, stage, messages);

    let chatHistory, userMessage;

    if (!history.length) {
      chatHistory = [];
      userMessage = `Open Case #${room.swapId?.toString().slice(-8).toUpperCase()}. Deliver your formal judicial opening statement now. Reference the actual case facts.`;
    } else if (history[history.length - 1].role === 'model') {
      chatHistory = history;
      userMessage = 'The parties are waiting. Continue presiding. Make your next specific judicial move based on where the proceeding stands.';
    } else {
      chatHistory = history.slice(0, -1);
      userMessage = history[history.length - 1].parts[0].text;
    }

    const chat    = model.startChat({ history: chatHistory, systemInstruction: systemPrompt });
    const result  = await chat.sendMessage(userMessage);
    const rawText = result.response.text().trim();

    return {
      text:       cleanAriaText(rawText),
      directives: parseAriaDirectives(rawText),
    };
  } catch (err) {
    console.error('Gemini error:', err.message);
    return getFallbackResponse(stage, room, messages);
  }
};

// ── Context-aware fallback (no API key) ───────────────────────────────────────
const getFallbackResponse = (stage, room, messages = []) => {
  const s           = room.swapSnapshot || {};
  const caseRef     = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const partyMsgs   = Array.isArray(messages) ? messages.filter(m => !['system', 'bot'].includes(m.senderRole)) : [];
  const ariaMsgs    = Array.isArray(messages) ? messages.filter(m => m.senderRole === 'bot') : [];
  const priorAria   = ariaMsgs.length;
  const partyCount  = partyMsgs.length;
  const ngn         = (k) => k ? '₦' + (k / 100).toLocaleString() : '';

  const claimantCount = partyMsgs.filter(m => (m.senderId?._id?.toString() || m.senderId?.toString()) === room.claimantId?.toString()).length;
  const respondentCount = partyMsgs.filter(m => (m.senderId?._id?.toString() || m.senderId?.toString()) === room.respondentId?.toString()).length;
  const bothSpoken = claimantCount >= 1 && respondentCount >= 1;
  const highStakes = (s.escrowDepositKobo || 0) >= 500000;

  if (stage === 'opening') {
    if (priorAria === 0) {
      const escrowNote = s.escrowDepositKobo ? `Escrow frozen: **${ngn(s.escrowDepositKobo)}** per party.` : '';
      const shippingNote = s.initiatorShipped && !s.receiverShipped
        ? `\n\n⚠️ **Note:** The dossier shows the Claimant shipped their item (${s.initiatorShipment?.trackingNumber ? `tracking: ${s.initiatorShipment.trackingNumber}` : 'no tracking on record'}) but the Respondent has NOT shipped. This court notes this discrepancy.`
        : !s.initiatorShipped && s.receiverShipped
        ? `\n\n⚠️ **Note:** The dossier shows the Respondent shipped but the Claimant has NOT shipped. This court notes this discrepancy.`
        : s.initiatorShipped && s.receiverShipped && !s.initiatorConfirmed && !s.receiverConfirmed
        ? `\n\n⚠️ **Note:** Both parties shipped, but neither confirmed receipt. The dispute arose at delivery/receipt stage.`
        : '';

      return {
        text: `**Case #${caseRef} — SwapNaija Dispute Court is now in session**

I am ARIA, your presiding AI judge. I hold full judicial authority and will issue the binding ruling in this case — no administrator required.

**THE MATTER:** ${s.claimantName || 'Claimant'} disputes a swap of **"${s.initiatorListingTitle || 'an item'}"** for **"${s.receiverListingTitle || 'an item'}"**.
**Dispute basis:** *"${s.disputeReason || 'not specified'}"*
${escrowNote}${shippingNote}
${highStakes ? '\n🔴 **HIGH STAKES CASE:** Both parties have the right to appoint legal counsel from the SwapNaija Legal Directory. Counsel may represent you throughout these proceedings.' : '\n💡 Parties may optionally appoint legal counsel from the SwapNaija Legal Directory.'}

**Stages:** Opening → Evidence → Deliberation → Ruling (issued by me)

**Claimant**, you filed this dispute. I need you to state: (1) exactly what went wrong, (2) when you first noticed it, (3) what resolution you are seeking. Be precise — vague claims carry no weight before this court.`,
        directives: { advanceStage: false, ruling: null },
      };
    }

    const probes = [
      `Noted for the record. **Claimant** — the swap data shows ${s.initiatorShipped ? `you shipped your item (${s.initiatorShipment?.providerLabel || 'courier'} tracking: ${s.initiatorShipment?.trackingNumber || 'not recorded'})` : 'your item has NOT been marked as shipped'}. Does your dispute relate to the condition of the item received, the failure to ship, or something else? Be specific.`,
      `Thank you. **Respondent** — the court record shows ${s.receiverShipped ? `you shipped your item (${s.receiverShipment?.providerLabel || 'courier'} tracking: ${s.receiverShipment?.trackingNumber || 'not recorded'})` : 'no shipping record on your side'}. Give your account of events. What actually happened and when?`,
      `Both accounts are on the record. The swap was ${s.acceptedAt ? `accepted on ${new Date(s.acceptedAt).toLocaleDateString('en-NG')}` : 'accepted at an unknown date'} and the dispute was filed on ${s.disputeRaisedAt ? new Date(s.disputeRaisedAt).toLocaleDateString('en-NG') : 'an unknown date'}. **Has either party made any attempt to resolve this directly before raising this dispute?**`,
      `Opening is now closed. This court has heard enough to proceed. Advancing to the Evidence stage — both parties should be ready to submit documentation.`,
    ];
    // Once we've cycled through all probes or both spoke, signal advance
    const probeIdx = Math.min(Math.max(partyCount - 1, 0), probes.length - 1);
    const autoAdvance = bothSpoken && partyCount >= 2;
    return { text: probes[probeIdx], directives: { advanceStage: autoAdvance || probeIdx >= probes.length - 1, ruling: null } };
  }

  if (stage === 'evidence') {
    const checklist = buildEvidenceChecklist(s);
    const prompts = [
      `**Evidence Stage — Case #${caseRef}**\n\nOpening is closed. I will now systematically gather evidence.\n\nRequired for this case:\n${checklist}\n\n**Claimant**, begin with your strongest piece of evidence. Describe it precisely — what it is, what it shows, and when it was created.`,
      `Noted. **Claimant** — the court requires photographic or documentary proof. ${s.initiatorShipped ? `You have a shipment on record (tracking: ${s.initiatorShipment?.trackingNumber || 'unrecorded'}). Provide proof that what was shipped matched what was agreed.` : 'You have no shipping record on file. Explain this.'} Submit the evidence or explain its absence.`,
      `This court acknowledges that submission. **Respondent** — respond directly to the Claimant's evidence and present your counter-evidence. ${s.receiverShipped ? `Your shipment (tracking: ${s.receiverShipment?.trackingNumber || 'unrecorded'}) is on record. Does it support your position?` : 'Note: no shipping record exists for you in this case.'}`,
      `Recorded. I must press both parties: is there photographic proof of item condition at the time of dispatch? Photos taken before packing carry the highest evidentiary weight. Submit your final evidence now.`,
      `The evidence record is sufficient for deliberation. Closing the evidence stage — advancing to deliberation.`,
    ];
    const idx = Math.min(Math.max(partyCount - 1, 0), prompts.length - 1);
    const autoAdvance = (partyCount >= 4 && bothSpoken) || idx >= prompts.length - 1;
    return { text: prompts[idx], directives: { advanceStage: autoAdvance, ruling: null } };
  }

  if (stage === 'deliberation') {
    const escrow = s.escrowDepositKobo ? ngn(s.escrowDepositKobo) : 'undisclosed';
    const shippingAnalysis = s.initiatorShipped && s.receiverShipped
      ? `Both parties have shipping records on file.`
      : s.initiatorShipped && !s.receiverShipped
      ? `⚠️ Only the Claimant has a shipping record. The Respondent has no recorded shipment.`
      : !s.initiatorShipped && s.receiverShipped
      ? `⚠️ Only the Respondent has a shipping record. The Claimant did not ship.`
      : `⚠️ Neither party has a verified shipping record — this is highly significant.`;

    const text = `**⚖️ JUDGMENT — Case #${caseRef}**

Having reviewed all submissions and cross-referenced the objective swap dossier, I now issue my finding.

**FACTS ESTABLISHED:**
• Swap agreed: "${s.initiatorListingTitle || 'an item'}" ↔ "${s.receiverListingTitle || 'an item'}" — escrow frozen: ${escrow} per party
• Dispute filed: *"${s.disputeReason || 'as stated'}"* on ${s.disputeRaisedAt ? new Date(s.disputeRaisedAt).toLocaleDateString('en-NG') : 'file date'}
• ${shippingAnalysis}
• Confirmations: Claimant ${s.initiatorConfirmed ? '✓ confirmed receipt' : '✗ did not confirm'} | Respondent ${s.receiverConfirmed ? '✓ confirmed receipt' : '✗ did not confirm'}

**ANALYSIS:**
The dispute arose from ${s.disputeReason?.toLowerCase().includes('not') || s.disputeReason?.toLowerCase().includes('fail') ? 'an alleged failure to deliver or perform as agreed' : 'a disagreement over the swap execution'}. Neither party produced definitive documentary proof sufficient to establish clear fault on the other side.

**RULING — MUTUAL RELEASE:**
Insufficient evidence to rule decisively in favour of either party. The swap is voided. Both parties are released. Escrow refunds will be processed per platform policy.

*Case #${caseRef} is CLOSED. Ruling issued by ARIA — Presiding Judge.*`;

    return {
      text,
      directives: { advanceStage: false, ruling: { decision: 'mutual_release', adminNote: `Insufficient definitive evidence. Dispute: "${s.disputeReason}". Shipping: ${s.initiatorShipped ? 'Claimant shipped' : 'Claimant did not ship'}; ${s.receiverShipped ? 'Respondent shipped' : 'Respondent did not ship'}. Mutual release is most equitable.` } },
    };
  }

  return {
    text: `**Case #${caseRef} — CLOSED**\n\nThe ruling stands. Both parties must comply. Escrow funds are being processed.\n\n*ARIA — Presiding Judge — signing off.*`,
    directives: { advanceStage: false, ruling: null },
  };
};

// ── Stage transition announcement ─────────────────────────────────────────────
const getAriaStageAnnouncement = async (room, newStage, messages = []) => {
  const apiKey  = process.env.GEMINI_API_KEY;
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const s       = room.swapSnapshot || {};
  const ngn     = (k) => k ? '₦' + (k / 100).toLocaleString() : '';

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature:     0.82,
          maxOutputTokens: newStage === 'deliberation' ? 900 : 350,
        },
      });

      let prompt;

      if (newStage === 'deliberation') {
        const histText = buildHistory(messages).map(h => h.parts[0].text).join('\n\n---\n\n');
        const checklist = buildEvidenceChecklist(s);
        const dossier   = buildCaseDossier(s, caseRef);

        prompt = `You are ARIA, the sole AI judge of the SwapNaija Dispute Court.

${dossier}

EVIDENCE CHECKLIST USED IN THIS CASE:
${checklist}

FULL PROCEEDING TRANSCRIPT:
${histText || '(No messages — very limited evidence)'}

The evidence stage is CLOSED. You must now deliberate and issue your FINAL BINDING RULING.

Structure:
1. "Having reviewed all evidence and submissions in Case #${caseRef}..." (1 sentence)
2. **FACTS ESTABLISHED** — 3 bullet points cross-referencing claims against the DOSSIER data above
3. **CONTESTED POINTS** — 2 bullet points of what remains unresolved
4. **CREDIBILITY ASSESSMENT** — Which party's account is more credible and specifically why (cite evidence submitted or notably absent)
5. **RULING** — Clear, precise ruling announcement with your decision

Then append (invisible to users):
${RULING_OPEN}{"decision":"CODE","adminNote":"2-3 sentence detailed reasoning citing specific facts"}${RULING_CLOSE}

Codes: compensate_claimant · compensate_respondent · split · mutual_release · penalty_claimant · penalty_respondent

Key facts to reference in your reasoning:
- Initiator shipped: ${s.initiatorShipped ? 'YES' : 'NO'} | Receiver shipped: ${s.receiverShipped ? 'YES' : 'NO'}
- Initiator confirmed: ${s.initiatorConfirmed ? 'YES' : 'NO'} | Receiver confirmed: ${s.receiverConfirmed ? 'YES' : 'NO'}
- Dispute reason: "${s.disputeReason || 'not specified'}"
- Escrow: ${ngn(s.escrowDepositKobo)} per party

Be decisive. Choose the ruling that best fits the evidence. Do NOT always default to mutual_release if the facts point elsewhere.`;
      } else {
        const dossier = buildCaseDossier(s, caseRef);
        prompt = `You are ARIA, the AI judge for SwapNaija Case #${caseRef}. The case is advancing to ${newStage.toUpperCase()}.

${dossier}

Deliver a crisp formal stage transition announcement under 150 words. Reference specific case facts. State exactly what is expected from each party in this new stage. Do not re-introduce yourself or repeat the opening.`;
      }

      const result  = await model.generateContent(prompt);
      const rawText = result.response.text().trim();

      return {
        text:       cleanAriaText(rawText),
        directives: parseAriaDirectives(rawText),
      };
    } catch (err) {
      console.error('Gemini stage announcement error:', err.message);
    }
  }

  // Fallback
  if (newStage === 'deliberation') return getFallbackResponse('deliberation', room, messages);

  const dossier = buildCaseDossier(s, caseRef);
  const texts = {
    evidence: `**🔍 STAGE 2: EVIDENCE — Case #${caseRef}**\n\nOpening is closed.\n\n${dossier}\n\nRequired evidence:\n${buildEvidenceChecklist(s)}\n\n**Claimant**, submit your first piece of evidence now. Describe exactly what it proves.`,
    ruling:   `**🔨 RULING — Case #${caseRef}**\n\nDeliberation is complete. My ruling will be issued momentarily.`,
    closed:   `**✅ CLOSED — Case #${caseRef}**\n\nThis proceeding is concluded. The ruling is final and binding.\n\n*ARIA — Presiding Judge — signing off.*`,
  };

  return {
    text:       texts[newStage] || `**Stage: ${newStage.toUpperCase()} — Case #${caseRef}** — Proceedings continue.`,
    directives: { advanceStage: false, ruling: null },
  };
};

module.exports = { getAriaResponse, getAriaStageAnnouncement, parseAriaDirectives, cleanAriaText, detectAdvanceTrigger };
