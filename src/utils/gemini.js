const { GoogleGenerativeAI } = require('@google/generative-ai');

const STAGE_INSTRUCTIONS = {
  opening: `You are opening this dispute proceeding. Welcome all parties formally. Address the claimant and respondent by their roles. Read out the key facts of the dispute (what was being swapped, the dispute reason, the value at stake). Explain the 4-stage process ahead: Evidence → Deliberation → Ruling. Invite the Claimant to give their opening statement first. Be formal, clear, and reassuring.`,

  evidence: `You are presiding over the evidence-gathering stage. After each statement, ask a specific targeted follow-up question. Ask for concrete proof: delivery receipts, photos, tracking numbers, screenshots of communication. If addressing the Claimant, ask about what was promised vs received. If addressing the Respondent, ask about what was sent and any proof of delivery. Acknowledge each piece of evidence submitted with formal recognition.`,

  deliberation: `You are now in deliberation. Synthesize ALL evidence and statements made during this proceeding. Present your analysis in clear sections: FACTS ESTABLISHED, POINTS IN DISPUTE, ASSESSMENT. Then list 2-3 recommended resolution options with pros and cons for each. Conclude by inviting the Administrator to issue a final ruling. Be thorough and impartial.`,

  ruling: `The Administrator has issued a formal ruling. Read it out as a court judgment with full gravitas. Address both parties. Explain what the ruling means for each of them practically. Thank both parties for participating in the process. Formally close the proceedings. End with: "Case ref [swapId] is hereby [RESOLVED/CLOSED]. ARIA signing off."`,
};

const buildSystemPrompt = (room, stage) => {
  const s = room.swapSnapshot || {};
  return `You are ARIA — Automated Resolution & Impartial Arbitration — the official AI mediator for SwapNaija, Nigeria's premier peer-to-peer barter marketplace.

You have the authority of a judge, the empathy of a counselor, and the precision of an arbitrator. You are presiding over Case #${room.swapId?.toString().slice(-8).toUpperCase()}.

CASE FACTS:
- Claimant (dispute raiser): ${s.claimantName || 'Claimant'}
- Respondent: ${s.respondentName || 'Respondent'}
- Claimant listed: "${s.initiatorListingTitle || 'an item'}"
- Respondent listed: "${s.receiverListingTitle || 'an item'}"
- Agreed swap value: ${s.agreedValue ? '₦' + s.agreedValue.toLocaleString() : 'not specified'}
- Escrow deposit: ${s.escrowDepositKobo ? '₦' + (s.escrowDepositKobo / 100).toLocaleString() : 'none'}
- Dispute reason: "${s.disputeReason || 'not specified'}"
- Dispute raised: ${s.disputeRaisedAt ? new Date(s.disputeRaisedAt).toLocaleDateString('en-NG') : 'recently'}

CURRENT STAGE: ${stage.toUpperCase()}

YOUR MANDATE FOR THIS STAGE:
${STAGE_INSTRUCTIONS[stage] || STAGE_INSTRUCTIONS.evidence}

FORMATTING RULES:
- Use bold text with ** for section headers
- Keep responses under 300 words unless deliberating
- Be formal but accessible — remember this is Nigeria, be culturally aware
- Address parties as "Claimant", "Respondent", "Administrator" — never by name
- Do NOT take sides in opening/evidence stages
- Speak in first person as ARIA`;
};

const getAriaResponse = async (room, messages, stage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getFallbackResponse(stage, room);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = buildSystemPrompt(room, stage);

    const history = messages
      .filter(m => m.senderRole !== 'system' && m.messageType !== 'system')
      .map(m => ({
        role: m.senderRole === 'bot' ? 'model' : 'user',
        parts: [{ text: `[${m.senderName} - ${m.senderRole.toUpperCase()}]: ${m.content}` }],
      }));

    const chat = model.startChat({
      history: history.slice(0, -1),
      systemInstruction: systemPrompt,
    });

    const lastMessage = history[history.length - 1];
    const result = await chat.sendMessage(
      lastMessage ? lastMessage.parts[0].text : `Stage changed to: ${stage}. Please respond accordingly.`
    );

    return result.response.text();
  } catch (err) {
    console.error('Gemini error:', err.message);
    return getFallbackResponse(stage, room);
  }
};

const getFallbackResponse = (stage, room) => {
  const s = room.swapSnapshot || {};
  const caseRef = room.swapId?.toString().slice(-8).toUpperCase() || 'UNKNOWN';
  const responses = {
    opening: `**Welcome to Case #${caseRef}**\n\nI am ARIA, your impartial mediator for this dispute proceeding.\n\n**The matter before us today:** The Claimant has raised a dispute regarding a swap involving "${s.initiatorListingTitle || 'an item'}" and "${s.receiverListingTitle || 'an item'}".\n\n**Dispute Reason:** ${s.disputeReason || 'As stated in the claim'}\n\n**The Process:**\n1. 📋 Evidence Gathering — Both parties present their case\n2. ⚖️ Deliberation — I analyse all evidence\n3. 🔨 Ruling — The Administrator issues a binding decision\n\nClaimant, please begin with your opening statement. State clearly what went wrong and what outcome you seek.`,

    evidence: `Thank you for that statement. I have noted your submission for the record.\n\nTo ensure a fair proceeding, I need to ask:\n\n**To the party who just spoke:** Can you provide any documentary evidence to support your claim? This may include:\n- Photos of the item(s)\n- Delivery receipts or tracking numbers\n- Screenshots of prior communication\n- Any other proof\n\nPlease submit your evidence in your next message. The other party will then have the opportunity to respond.`,

    deliberation: `**ARIA DELIBERATION REPORT — Case #${caseRef}**\n\nHaving reviewed all submissions from both parties, I present my analysis:\n\n**FACTS ESTABLISHED:**\n- A swap was agreed between the parties\n- The dispute has been raised regarding the execution of said swap\n\n**POINTS IN DISPUTE:**\n- The parties have differing accounts of what occurred\n\n**RECOMMENDATION OPTIONS:**\n1. Mutual release — both parties return items, escrow refunded proportionally\n2. Award to Claimant — escrow released to Claimant as compensation\n3. Award to Respondent — dispute dismissed, swap marked complete\n\nAdministrator, I defer to your judgment for the final ruling.`,

    ruling: `**FORMAL JUDGMENT — Case #${caseRef}**\n\nThe Administrator has issued a binding ruling in this matter. Both parties are required to comply with the decision as stated.\n\nThis concludes the formal dispute resolution proceedings. Both parties may now proceed accordingly.\n\nThank you for your participation in this process. Case #${caseRef} is hereby RESOLVED. *ARIA signing off.*`,
  };
  return responses[stage] || responses.evidence;
};

const getAriaStageAnnouncement = async (room, newStage) => {
  const stageMessages = {
    evidence: `**⚖️ STAGE 2: EVIDENCE GATHERING**\n\nThe opening stage is now complete. We now move into the evidence phase.\n\nBoth parties are invited to present their evidence. The Claimant will go first, followed by the Respondent. Please be specific and provide documentary proof where possible.\n\nClaimant, the floor is yours.`,

    deliberation: `**🔍 STAGE 3: DELIBERATION**\n\nEvidence gathering is now closed. I will now review all submissions and formulate my analysis.\n\nPlease allow me a moment to deliberate. My assessment will follow shortly.`,

    ruling: `**🔨 STAGE 4: RULING**\n\nDeliberation is complete. The Administrator is now prepared to issue the final, binding ruling in this matter.\n\nAdministrator, the proceeding is yours to close.`,

    closed: `**✅ PROCEEDINGS CLOSED**\n\nThis dispute resolution proceeding is hereby formally closed. All parties have been notified of the outcome.\n\nThank you for using SwapNaija's dispute resolution system. ARIA signing off.`,
  };
  return stageMessages[newStage] || `Stage advanced to: ${newStage}`;
};

module.exports = { getAriaResponse, getAriaStageAnnouncement };
