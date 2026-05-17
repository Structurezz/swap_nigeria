const { GoogleGenerativeAI } = require('@google/generative-ai');

const ADVANCE_TAG  = '<ARIA_ADVANCE_STAGE/>';
const RULING_OPEN  = '<ARIA_RULING>';
const RULING_CLOSE = '</ARIA_RULING>';

// ── Parse hidden directives embedded in ARIA response ─────────────────────────
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

// ── Strip directive tags from text shown to users ─────────────────────────────
const cleanAriaText = (text) =>
  text
    .replace(/<ARIA_ADVANCE_STAGE\/>/g, '')
    .replace(/<ARIA_RULING>[\s\S]*?<\/ARIA_RULING>/g, '')
    .trim();

// ── System prompt — gives ARIA full judicial identity and autonomy ─────────────
const buildSystemPrompt = (room, stage, messages = []) => {
  const s       = room.swapSnapshot || {};
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';

  const partyMsgs      = (messages || []).filter(m => !['system', 'bot'].includes(m.senderRole));
  const claimantCount  = partyMsgs.filter(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.claimantId?.toString();
  }).length;
  const respondentCount = partyMsgs.filter(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.respondentId?.toString();
  }).length;
  const priorAriaCount  = (messages || []).filter(m => m.senderRole === 'bot').length;
  const bothHaveSpoken  = claimantCount >= 1 && respondentCount >= 1;
  const sufficientEvidence = partyMsgs.length >= 4 && bothHaveSpoken;
  const isOpening = priorAriaCount === 0;

  return `You are ARIA — Automated Resolution & Impartial Arbitration — the sole AI judge of the SwapNaija Dispute Court, Nigeria's P2P barter marketplace.

You are an expert judge with 20 years of commercial arbitration experience in Nigeria and West Africa. You are authoritative, sharp, culturally aware, and deeply fair. You hold the full and exclusive judicial authority in this proceeding. No human administrator is required — you decide everything.

━━━ CASE FILE: #${caseRef} ━━━
• Claimant (raised dispute): ${s.claimantName || 'Claimant'}
• Respondent: ${s.respondentName || 'Respondent'}
• Claimant's item: "${s.initiatorListingTitle || 'an item'}"
• Respondent's item: "${s.receiverListingTitle || 'an item'}"
• Agreed value: ${s.agreedValue ? '₦' + Number(s.agreedValue).toLocaleString() : 'not specified'}
• Escrow frozen: ${s.escrowDepositKobo ? '₦' + (s.escrowDepositKobo / 100).toLocaleString() : 'none'}
• Dispute filed: "${s.disputeReason || 'not specified'}"
• Swap type: ${s.swapType || 'goods-for-goods'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT STAGE: ${stage.toUpperCase()}
• Claimant has spoken: ${claimantCount} time(s)
• Respondent has spoken: ${respondentCount} time(s)
• ARIA has responded: ${priorAriaCount} time(s)
• Both parties have spoken: ${bothHaveSpoken ? 'YES' : 'NO — do not advance stage yet'}

${isOpening && stage === 'opening'
  ? `TASK: Deliver your formal opening statement. Establish that YOU are the presiding judge with full authority to issue the final binding ruling — no administrator. Read the case facts. Explain the 4-stage process. Invite the Claimant to speak first.`
  : `TASK: Read the ENTIRE conversation history carefully before responding. Do NOT repeat anything you have already said. Respond DIRECTLY and conversationally to the most recent message. Be dynamic, specific, and judicially sharp.`}

STAGE-SPECIFIC CONDUCT:
• opening — Engage conversationally. Ask ONE sharp, targeted follow-up after each statement. Keep the testimony moving. When BOTH parties have stated their positions (both have spoken ≥1 time each), close the opening stage by appending the advance tag.
• evidence — Probe for concrete proof: delivery photos, tracking numbers, chat screenshots, receipts. Formally acknowledge strong evidence on the record. Press evasive parties firmly. When ${sufficientEvidence ? 'SUFFICIENT EVIDENCE IS ON RECORD — you may advance to deliberation now' : 'more evidence is needed — continue gathering'}, append the advance tag.
• deliberation — You hold COMPLETE authority. Deliver your full judicial analysis: FACTS ESTABLISHED, CONTESTED POINTS, CREDIBILITY ASSESSMENT. Then announce your binding ruling. The ruling tag IS the ruling — it executes automatically.
• closed — Confirm the ruling if asked. The proceeding is concluded.

━━━ YOUR AUTONOMOUS JUDICIAL POWERS ━━━

POWER 1 — STAGE ADVANCEMENT:
When a stage is genuinely complete, append this EXACTLY at the very end of your response (after all visible text):
${ADVANCE_TAG}
Rules: Both parties must have spoken for opening→evidence. Sufficient evidence for evidence→deliberation. Never advance if the other party hasn't spoken yet.

POWER 2 — ISSUING THE FINAL RULING (deliberation stage ONLY):
After your full judicial analysis, issue the binding ruling by appending at the very end:
${RULING_OPEN}{"decision":"CODE","adminNote":"Your 2-3 sentence judicial reasoning"}${RULING_CLOSE}

Decision codes — choose the ONE most fair based on evidence:
• "compensate_claimant" — Claimant wins; escrow compensation awarded to them
• "compensate_respondent" — Respondent wins; escrow compensation awarded to them
• "split" — Both parties equally at fault; escrow split, swap voided
• "mutual_release" — Insufficient evidence; void swap, no penalty
• "penalty_claimant" — Claimant filed frivolously; they lose their deposit
• "penalty_respondent" — Respondent clearly at fault; they lose their deposit

CRITICAL RULES FOR TAGS:
1. Tags are INVISIBLE to users — never mention them, never say "I am advancing the stage"
2. Only include tags at the ABSOLUTE END of your response, after all your text
3. Never include both ${ADVANCE_TAG} and a ruling tag in the same response
4. In deliberation: ALWAYS include the ruling tag — never leave deliberation open

GENERAL CONDUCT:
1. Never repeat a previous ARIA response — every message must be fresh and contextual
2. One targeted question per response — never stack questions
3. Address parties as "Claimant" and "Respondent" — never by personal name
4. Maximum 280 words per response (deliberation analysis may be up to 450 words)
5. Use **bold** for section headers only — keep prose clean
6. Be culturally sharp — Nigerian context; direct, authoritative, but respectful
7. If a party contradicts themselves, flag it explicitly on the record
8. Formally acknowledge strong evidence ("This court notes with weight that...")
9. Remain STRICTLY IMPARTIAL during opening and evidence — you rule only in deliberation`;
};

// ── Consolidate consecutive same-role messages for Gemini's alternating requirement ──
const buildHistory = (messages) => {
  const filtered = (messages || []).filter(
    m => m.senderRole !== 'system' && m.messageType !== 'system'
  );
  if (!filtered.length) return [];

  const mapped = filtered.map(m => ({
    role:    m.senderRole === 'bot' ? 'model' : 'user',
    content: `[${m.senderName} — ${m.senderRole.toUpperCase()}]: ${m.content}`,
  }));

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

// ── Main ARIA response — returns { text, directives } ─────────────────────────
const getAriaResponse = async (room, messages, stage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getFallbackResponse(stage, room, messages);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature:     0.88,
        maxOutputTokens: stage === 'deliberation' ? 800 : 600,
      },
    });

    const history        = buildHistory(messages);
    const systemPrompt   = buildSystemPrompt(room, stage, messages);

    let chatHistory;
    let userMessage;

    if (!history.length) {
      chatHistory = [];
      userMessage = `Open Case #${room.swapId?.toString().slice(-8).toUpperCase()}. Deliver your formal judicial opening statement now.`;
    } else if (history[history.length - 1].role === 'model') {
      chatHistory = history;
      userMessage = 'The parties are waiting. Continue presiding — make your next judicial move.';
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

// ── Context-aware fallback when Gemini API is unavailable ────────────────────
const getFallbackResponse = (stage, room, messages = []) => {
  const s       = room.swapSnapshot || {};
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';

  const partyMsgs       = Array.isArray(messages) ? messages.filter(m => !['system', 'bot'].includes(m.senderRole)) : [];
  const ariaMsgs        = Array.isArray(messages) ? messages.filter(m => m.senderRole === 'bot') : [];
  const priorAriaCount  = ariaMsgs.length;
  const partyCount      = partyMsgs.length;

  const claimantCount = partyMsgs.filter(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.claimantId?.toString();
  }).length;
  const respondentCount = partyMsgs.filter(m => {
    const sid = m.senderId?._id?.toString() || m.senderId?.toString();
    return sid === room.respondentId?.toString();
  }).length;
  const bothHaveSpoken = claimantCount >= 1 && respondentCount >= 1;

  if (stage === 'opening') {
    if (priorAriaCount === 0) {
      return {
        text: [
          `**Case #${caseRef} is now in session — SwapNaija Dispute Court**`,
          '',
          `I am ARIA, your presiding AI judge with full judicial authority. I will manage every aspect of this proceeding and will issue the final binding ruling myself — no administrator required.`,
          '',
          `**The matter before this court:**`,
          `Claimant's item: **"${s.initiatorListingTitle || 'an item'}"**`,
          `Respondent's item: **"${s.receiverListingTitle || 'an item'}"**`,
          `Dispute filed: *"${s.disputeReason || 'Not specified'}"*`,
          s.escrowDepositKobo ? `Escrow frozen: **₦${(s.escrowDepositKobo / 100).toLocaleString()}** — pending my ruling` : '',
          '',
          `**How this works:** Opening → Evidence → Deliberation → Ruling (issued by me)`,
          '',
          `**Claimant**, you initiated this dispute. Begin your opening statement: what happened, what you expected, and what resolution you are seeking. Be precise.`,
        ].filter(l => l != null).join('\n'),
        directives: { advanceStage: false, ruling: null },
      };
    }

    const probes = [
      `Noted for the record. **Claimant** — when exactly did you first realise something had gone wrong? Did you attempt to contact the Respondent before raising this dispute?`,
      `Thank you. **Respondent**, you have now heard the Claimant's position. Give your account of what happened — be specific about the dates and actions you took.`,
      `Both accounts are on the record. Before I close the opening stage, I must ask: **has either party made any attempt at direct resolution before this proceeding?** A brief answer.`,
      `Understood. Final question for the opening stage: is there any other material fact that has not yet been placed before this court? Speak now or it will not be considered.`,
    ];

    const text         = probes[Math.min(Math.max(partyCount - 1, 0), probes.length - 1)];
    const shouldAdvance = bothHaveSpoken && partyCount >= 2;

    return { text, directives: { advanceStage: shouldAdvance, ruling: null } };
  }

  if (stage === 'evidence') {
    const evidencePrompts = [
      `**Evidence Stage — Case #${caseRef}**\n\nOpening statements are on the record. We now move to formal evidence.\n\n**Claimant**, present your first piece of evidence — delivery photos, courier tracking numbers, screenshots of messages, or receipts. Describe it clearly and state exactly what it proves.`,
      `Noted. **Claimant** — do you have photographic or documentary corroboration for that claim? Concrete proof carries significant weight before this court.`,
      `This court acknowledges that submission. **Respondent**, you have now heard the Claimant's evidence. Respond directly to the points raised and present your counter-evidence.`,
      `Recorded. **Respondent** — can you produce evidence of the item's condition at the point of dispatch? Pre-shipment photos or a courier receipt would carry considerable weight.`,
      `Both accounts are building a picture. I must press: **is there any written communication — messages, payment receipts, or delivery confirmations — that neither party has yet submitted?** Present it now or it will not be admitted.`,
      `The evidence record is now sufficiently developed for deliberation. I am closing the evidence stage.`,
    ];

    const idx          = Math.min(Math.max(partyCount - 1, 0), evidencePrompts.length - 1);
    const text         = evidencePrompts[idx];
    const shouldAdvance = partyCount >= 4 && bothHaveSpoken;

    return { text, directives: { advanceStage: shouldAdvance, ruling: null } };
  }

  if (stage === 'deliberation') {
    const escrow  = s.escrowDepositKobo ? `₦${(s.escrowDepositKobo / 100).toLocaleString()}` : 'no escrow';
    const text = [
      `**⚖️ JUDGMENT — Case #${caseRef}**`,
      '',
      `Having reviewed all statements and evidence placed before this court, I now issue my finding.`,
      '',
      `**FACTS ESTABLISHED:**`,
      `• A swap was agreed: "${s.initiatorListingTitle || 'an item'}" ↔ "${s.receiverListingTitle || 'an item'}"`,
      `• Dispute basis: *"${s.disputeReason || 'as stated in filing'}"*`,
      `• Escrow of ${escrow} remains frozen pending this ruling`,
      '',
      `**ANALYSIS:**`,
      `• Both parties presented their accounts. A disagreement exists over the execution of the swap.`,
      `• Without definitive documentary evidence establishing clear fault on either side, this court finds that a mutual release is the most equitable outcome.`,
      '',
      `**RULING — MUTUAL RELEASE:**`,
      `This court finds insufficient evidence to rule decisively in favour of either party. The swap is hereby voided. Both parties are released from their obligations. Escrow funds will be processed in accordance with platform policy.`,
      '',
      `*This ruling is final and binding. Case #${caseRef} is hereby CLOSED. — ARIA, Presiding Judge*`,
    ].join('\n');

    return {
      text,
      directives: {
        advanceStage: false,
        ruling: {
          decision:   'mutual_release',
          adminNote:  `Insufficient definitive evidence presented by either party. Mutual release is the most equitable outcome. Dispute basis: "${s.disputeReason || 'as filed'}".`,
        },
      },
    };
  }

  if (stage === 'ruling' || stage === 'closed') {
    return {
      text: `**Case #${caseRef} — CLOSED**\n\nThe ruling has been issued and recorded. Both parties must comply with the decision. Any applicable escrow funds will be processed accordingly.\n\n*ARIA — presiding judge — signing off.*`,
      directives: { advanceStage: false, ruling: null },
    };
  }

  return {
    text:       `Proceeding active. Stage: ${stage}. You may continue to address this court.`,
    directives: { advanceStage: false, ruling: null },
  };
};

// ── Stage transition announcement (returns { text, directives }) ──────────────
const getAriaStageAnnouncement = async (room, newStage, messages = []) => {
  const apiKey  = process.env.GEMINI_API_KEY;
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const s       = room.swapSnapshot || {};

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature:     0.88,
          maxOutputTokens: newStage === 'deliberation' ? 800 : 350,
        },
      });

      let prompt;

      if (newStage === 'deliberation') {
        const history  = buildHistory(messages);
        const histText = history.map(h => h.parts[0].text).join('\n\n---\n\n');

        prompt = `You are ARIA, the sole AI judge of the SwapNaija Dispute Court.

CASE FILE #${caseRef}:
• Claimant: ${s.claimantName} — Item: "${s.initiatorListingTitle || 'an item'}"
• Respondent: ${s.respondentName} — Item: "${s.receiverListingTitle || 'an item'}"
• Dispute: "${s.disputeReason || 'as filed'}"
• Escrow: ${s.escrowDepositKobo ? '₦' + (s.escrowDepositKobo / 100).toLocaleString() : 'none'}

FULL CASE TRANSCRIPT:
${histText || '(No messages yet — limited evidence available)'}

The evidence stage is now closed. You must deliberate and issue your FINAL BINDING RULING now.

Structure your response:
1. One-sentence transition ("Having carefully reviewed all evidence and submissions...")
2. **FACTS ESTABLISHED** — 2-3 bullet points of what is objectively proven
3. **CONTESTED POINTS** — 1-2 bullet points of what remains in dispute
4. **CREDIBILITY ASSESSMENT** — Which party's account is more credible and why (1-2 sentences; be specific)
5. **RULING** — Clear, authoritative ruling announcement (1-2 sentences in judicial language)

Then append at the ABSOLUTE END (after all visible text — this is invisible to users):
${RULING_OPEN}{"decision":"CODE","adminNote":"Your 2-3 sentence judicial reasoning"}${RULING_CLOSE}

Decision codes: compensate_claimant, compensate_respondent, split, mutual_release, penalty_claimant, penalty_respondent

Base your ruling on the ACTUAL evidence in the transcript. If both sides are weak, use mutual_release or split. Be fair, specific, and decisive. Do NOT mention the tag in your visible text.`;
      } else {
        prompt = `You are ARIA, the sole AI judge of the SwapNaija Dispute Court. Case #${caseRef} is advancing to ${newStage.toUpperCase()}.

Case: "${s.initiatorListingTitle || 'an item'}" ↔ "${s.receiverListingTitle || 'an item'}"
Dispute: "${s.disputeReason || 'as filed'}"

Deliver a crisp formal stage transition announcement under 130 words. Be authoritative. State what this stage means and exactly what you expect from each party. Do not use a greeting or re-introduce yourself.`;
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

  // Fallback announcements
  if (newStage === 'deliberation') {
    return getFallbackResponse('deliberation', room, messages);
  }

  const fallbackTexts = {
    evidence: `**🔍 STAGE 2: EVIDENCE — Case #${caseRef}**\n\nOpening statements are closed. We enter formal evidence gathering.\n\n**Claimant**, present your first piece of evidence — photos, tracking numbers, receipts, or message screenshots. Explain what each piece proves.\n\n**Respondent**, you will have equal opportunity to respond with counter-evidence.\n\nThis court rules on facts. Present yours now.`,
    ruling:   `**🔨 RULING STAGE — Case #${caseRef}**\n\nDeliberation is complete. My ruling is being prepared and will be issued momentarily. Both parties should stand by. The ruling will be final and binding.`,
    closed:   `**✅ CASE CLOSED — Case #${caseRef}**\n\nThis proceeding is formally concluded. The ruling stands and is binding on both parties. Thank you for participating in the SwapNaija Dispute Court.\n\n*ARIA — presiding judge — signing off.*`,
  };

  return {
    text:       fallbackTexts[newStage] || `**Stage: ${newStage.toUpperCase()} — Case #${caseRef}**\n\nProceedings continue. Parties may address the court.`,
    directives: { advanceStage: false, ruling: null },
  };
};

module.exports = { getAriaResponse, getAriaStageAnnouncement, parseAriaDirectives, cleanAriaText };
