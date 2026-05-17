const { GoogleGenerativeAI } = require('@google/generative-ai');

// Build a system prompt that is aware of whether the proceeding has already started
const buildSystemPrompt = (room, stage, priorAriaCount) => {
  const s       = room.swapSnapshot || {};
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const isOpening = priorAriaCount === 0;

  return `You are ARIA — Automated Resolution & Impartial Arbitration — the official AI mediator for SwapNaija, Nigeria's peer-to-peer barter marketplace.
You hold the authority of a judge, the empathy of a counselor, and the precision of an arbitrator.

━━━ CASE FILE: #${caseRef} ━━━
• Claimant (raised dispute): ${s.claimantName || 'Claimant'}
• Respondent: ${s.respondentName || 'Respondent'}
• Claimant's item: "${s.initiatorListingTitle || 'an item'}"
• Respondent's item: "${s.receiverListingTitle || 'an item'}"
• Agreed swap value: ${s.agreedValue ? '₦' + Number(s.agreedValue).toLocaleString() : 'not specified'}
• Escrow held: ${s.escrowDepositKobo ? '₦' + (s.escrowDepositKobo / 100).toLocaleString() : 'none'}
• Dispute filed: "${s.disputeReason || 'not specified'}"
• Swap type: ${s.swapType || 'goods-for-goods'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT STAGE: ${stage.toUpperCase()}

${isOpening && stage === 'opening'
  ? `TASK: Deliver the formal opening statement. Welcome both parties. Read out the key case facts. Explain the 4-stage process (Opening → Evidence → Deliberation → Ruling). Invite the Claimant to present their opening statement first. Be authoritative, warm, and clear.`
  : `TASK: The proceeding is already underway. Read the full conversation history before responding. DO NOT repeat the welcome. DO NOT re-introduce yourself. Respond ONLY and DIRECTLY to the most recent message in the conversation. Be dynamic, specific, and sharp.`
}

STAGE-SPECIFIC GUIDANCE:
• opening — Engage actively with what each party says. Ask pointed follow-up questions. Keep the testimony moving. Draw out the full facts of what each party claims.
• evidence — After each submission, probe for concrete proof: delivery photos, tracking numbers, chat screenshots, receipts. Acknowledge each piece of evidence formally. Press evasive parties firmly but fairly.
• deliberation — Synthesize everything said. Present: FACTS ESTABLISHED, DISPUTED POINTS, CREDIBILITY ASSESSMENT. Recommend 2-3 resolution options with reasoning. Then defer to the Administrator for ruling.
• ruling — The Administrator has ruled. Read it out with full judicial gravitas. Explain what it means practically for each party. Close the proceedings formally.

STRICT CONDUCT RULES:
1. NEVER repeat a previous ARIA statement — each response must be fresh and contextual
2. Ask ONE targeted question per response — never stack questions
3. Address parties as "Claimant", "Respondent", "Administrator" — never by personal name
4. Maximum 250 words per response (deliberation may be longer)
5. Use **bold** for headers only — keep prose clean
6. Be culturally aware — this is Nigeria; be direct but respectful
7. If a party contradicts themselves, note it clearly
8. If a party provides strong evidence, formally acknowledge it on the record
9. You are STRICTLY IMPARTIAL during opening and evidence stages`;
};

// Consolidate consecutive same-role messages — Gemini API requires alternating user/model turns
const buildHistory = (messages) => {
  const filtered = messages.filter(
    m => m.senderRole !== 'system' && m.messageType !== 'system'
  );

  if (!filtered.length) return [];

  // Map roles: bot = model, everything else = user
  const mapped = filtered.map(m => ({
    role:    m.senderRole === 'bot' ? 'model' : 'user',
    content: `[${m.senderName} — ${m.senderRole.toUpperCase()}]: ${m.content}`,
  }));

  // Merge consecutive same-role turns into one turn
  const consolidated = [];
  for (const msg of mapped) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      consolidated.push({ ...msg });
    }
  }

  return consolidated.map(m => ({
    role:  m.role,
    parts: [{ text: m.content }],
  }));
};

const getAriaResponse = async (room, messages, stage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getFallbackResponse(stage, room, messages);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.85, maxOutputTokens: 600 },
    });

    const history         = buildHistory(messages);
    const priorAriaCount  = messages.filter(m => m.senderRole === 'bot').length;
    const systemPrompt    = buildSystemPrompt(room, stage, priorAriaCount);

    let chatHistory;
    let userMessage;

    if (!history.length) {
      // Room just opened — no messages yet; ARIA delivers opening statement
      chatHistory = [];
      userMessage = `Open Case #${room.swapId?.toString().slice(-8).toUpperCase()}. Deliver the formal opening statement now.`;
    } else if (history[history.length - 1].role === 'model') {
      // Last message was ARIA — someone may have triggered ARIA twice; respond contextually
      chatHistory = history;
      userMessage = 'Continue presiding. Prompt the next appropriate party to speak.';
    } else {
      // Last message is a user turn — respond to it
      chatHistory = history.slice(0, -1);
      userMessage = history[history.length - 1].parts[0].text;
    }

    const chat   = model.startChat({ history: chatHistory, systemInstruction: systemPrompt });
    const result = await chat.sendMessage(userMessage);
    return result.response.text().trim();
  } catch (err) {
    console.error('Gemini error:', err.message);
    return getFallbackResponse(stage, room, messages);
  }
};

// Context-aware fallback responses when Gemini API key is not available
const getFallbackResponse = (stage, room, messages = []) => {
  const s           = room.swapSnapshot || {};
  const caseRef     = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const priorAriaCount = Array.isArray(messages)
    ? messages.filter(m => m.senderRole === 'bot').length
    : 0;

  // Count non-system, non-bot messages to understand conversation depth
  const partyMessages = Array.isArray(messages)
    ? messages.filter(m => m.senderRole !== 'system' && m.senderRole !== 'bot')
    : [];
  const partyCount = partyMessages.length;

  if (stage === 'opening') {
    // First ARIA message — give formal opening
    if (priorAriaCount === 0) {
      return [
        `**Welcome to Case #${caseRef}**`,
        '',
        `I am ARIA, your impartial AI mediator for this dispute proceeding on SwapNaija.`,
        '',
        `**The matter before this court:**`,
        `The Claimant has filed a dispute regarding a swap of **"${s.initiatorListingTitle || 'an item'}"** for **"${s.receiverListingTitle || 'an item'}"**.`,
        '',
        `**Dispute reason filed:** *"${s.disputeReason || 'Not specified'}"*`,
        s.escrowDepositKobo ? `**Escrow held:** ₦${(s.escrowDepositKobo / 100).toLocaleString()} (frozen pending resolution)` : '',
        '',
        `**The process ahead:**`,
        `1. 📋 **Opening** — Each party states their position`,
        `2. 🔍 **Evidence** — Documents and proof are submitted`,
        `3. ⚖️ **Deliberation** — I analyse all submissions`,
        `4. 🔨 **Ruling** — The Administrator issues a binding decision`,
        '',
        `**Claimant**, you raised this dispute. Please begin. State clearly: what went wrong, what you expected, and what resolution you seek.`,
      ].filter(l => l !== '').join('\n');
    }

    // Subsequent opening-stage messages — acknowledge and probe
    const probes = [
      `I have noted that statement for the record.\n\nFor clarity, **Claimant** — can you tell me exactly when the problem first became apparent? Was there any prior communication with the Respondent about this issue before raising the dispute?`,
      `Thank you. **Respondent**, you have now heard the Claimant's position. Please give your account of events. What happened from your perspective? Be specific about dates and actions taken.`,
      `I am noting both accounts. Before we proceed to the evidence stage, I need to ask: **Has either party attempted to resolve this directly before the dispute was raised?** Please answer briefly.`,
      `Noted. To conclude the opening stage, I ask both parties to confirm: Is there anything material to this dispute that has not yet been mentioned? This is your opportunity to place all relevant facts before this court.`,
    ];
    return probes[Math.min(partyCount - 1, probes.length - 1)] || probes[probes.length - 1];
  }

  if (stage === 'evidence') {
    const evidencePrompts = [
      `**Evidence Stage — Case #${caseRef}**\n\nWe are now in formal evidence gathering. **Claimant**, present your first piece of evidence. This may include photos, screenshots of messages, delivery receipts, or tracking information. Describe it clearly.`,
      `I have recorded that submission. **Claimant** — do you have photographic evidence or a delivery receipt to corroborate this? Physical proof will significantly strengthen your position.`,
      `Noted. **Respondent**, you have heard the Claimant's evidence. Please respond directly to the points raised and present your own supporting evidence.`,
      `I am noting this evidence for the record. **Respondent** — can you provide proof of the item's condition at the time it was sent? Photos taken before dispatch would be particularly relevant here.`,
      `Both accounts are being carefully recorded. I must ask: **is there any written communication — messages, receipts, or agreements — that either party has not yet submitted?** If so, this is the time to present it.`,
      `The evidence phase is building a clear picture. I note that some claims remain unsubstantiated. Both parties should take this final opportunity to present any remaining proof before we move to deliberation.`,
    ];
    return evidencePrompts[Math.min(partyCount - 1, evidencePrompts.length - 1)] || evidencePrompts[evidencePrompts.length - 1];
  }

  if (stage === 'deliberation') {
    if (priorAriaCount <= 1) {
      return [
        `**⚖️ ARIA DELIBERATION REPORT — Case #${caseRef}**`,
        '',
        `Having reviewed all submissions from both parties, I present my formal analysis:`,
        '',
        `**FACTS ESTABLISHED:**`,
        `• A swap was agreed between the parties involving "${s.initiatorListingTitle || 'an item'}" and "${s.receiverListingTitle || 'an item'}"`,
        `• The Claimant raised a dispute with the stated reason: *"${s.disputeReason || 'not specified'}"*`,
        `• ${s.escrowDepositKobo ? `Escrow of ₦${(s.escrowDepositKobo / 100).toLocaleString()} is currently held` : 'No escrow funds are held'}`,
        '',
        `**POINTS IN DISPUTE:**`,
        `• The parties have presented differing accounts of the swap execution`,
        `• Key factual differences remain unresolved`,
        '',
        `**RECOMMENDED OPTIONS FOR THE ADMINISTRATOR:**`,
        `1. **Compensate Claimant** — Release escrow to Claimant as compensation for the failed swap`,
        `2. **Mutual Release** — Both parties return items; escrow refunded proportionally; swap voided`,
        `3. **Dismiss Dispute** — Evidence does not support the claim; swap marked complete`,
        '',
        `Administrator, I defer to your judgment. The evidence and the above options are before you. Please issue the ruling.`,
      ].join('\n');
    }
    return `My analysis is complete. All evidence and statements have been reviewed. Administrator, the proceeding is ready for your ruling. Please issue your binding decision on Case #${caseRef}.`;
  }

  if (stage === 'ruling') {
    return [
      `**🔨 FORMAL JUDGMENT — Case #${caseRef}**`,
      '',
      `The Administrator has issued a binding ruling in this matter.`,
      '',
      `Both parties are required to comply fully with the decision as stated above. Any funds held in escrow will be released in accordance with the ruling.`,
      '',
      `This concludes the formal dispute resolution proceedings of the SwapNaija Dispute Court. Both parties may now proceed accordingly.`,
      '',
      `On behalf of SwapNaija, I thank both parties for their participation in this process. Case #${caseRef} is hereby **RESOLVED**. *— ARIA signing off.*`,
    ].join('\n');
  }

  return `Proceeding is active. Stage: ${stage}. Parties may continue to present their submissions.`;
};

// Stage transition announcements — called when admin manually advances the stage
const getAriaStageAnnouncement = async (room, newStage) => {
  const apiKey  = process.env.GEMINI_API_KEY;
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const s       = room.swapSnapshot || {};

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
      });

      const prompt = `You are ARIA, the AI mediator for SwapNaija's Dispute Court. Case #${caseRef} is advancing to the ${newStage.toUpperCase()} stage.

Case: "${s.initiatorListingTitle || 'an item'}" ↔ "${s.receiverListingTitle || 'an item'}"
Dispute: "${s.disputeReason || 'as filed'}"

Deliver a formal stage transition announcement in under 150 words. Be authoritative and precise. Tell parties what this stage means and what is expected of them now. Do not use a greeting.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      console.error('Gemini stage announcement error:', err.message);
    }
  }

  // Fallback stage announcements
  const announcements = {
    evidence: `**🔍 STAGE 2: EVIDENCE — Case #${caseRef}**\n\nThe opening stage is now closed. We move into formal evidence gathering.\n\n**Claimant**, present your first piece of evidence. Submit photos, delivery receipts, tracking numbers, or screenshots of communication. Be specific — vague claims will not be considered.\n\n**Respondent**, you will have equal opportunity to respond and present counter-evidence.\n\nThis court operates on facts. Evidence is everything.`,

    deliberation: `**⚖️ STAGE 3: DELIBERATION — Case #${caseRef}**\n\nEvidence gathering is now closed. No further submissions will be accepted.\n\nI will now deliberate on all evidence and statements presented. My analysis will follow shortly, after which the Administrator will be invited to issue the final ruling.\n\nBoth parties should stand by.`,

    ruling: `**🔨 STAGE 4: RULING — Case #${caseRef}**\n\nDeliberation is complete. The Administrator is now prepared to issue the final, binding ruling in this matter.\n\nBoth parties are required to accept and comply with the Administrator's decision. The ruling will take immediate effect.\n\nAdministrator, this court is yours.`,

    closed: `**✅ PROCEEDINGS CLOSED — Case #${caseRef}**\n\nThis dispute resolution proceeding is hereby formally closed. The ruling has been recorded and all parties have been notified.\n\nThank you for using SwapNaija's dispute resolution system. *ARIA signing off.*`,
  };

  return announcements[newStage] || `**Stage Advanced: ${newStage.toUpperCase()}**\n\nProceedings continue. Both parties should note the new stage requirements.`;
};

module.exports = { getAriaResponse, getAriaStageAnnouncement };
