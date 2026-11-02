import { extractQuery, findUrls, readCommand } from "./extract.js";
import { check, submitReport } from "./qwench.js";
import {
  DAILY_LIMIT,
  GENERIC_ERROR,
  HELP,
  IMAGE_ANALYSING,
  IMAGE_NO_NAME,
  VOICE_UNSUPPORTED,
  buildDidYouMean,
  buildReply,
  welcomeBlock,
} from "./reply.js";
import { STEP, getSession, markGreeted, reset, setStep } from "./sessions.js";

/**
 * One conversation handler for every channel.
 *
 * WhatsApp and Telegram differ only in how a message arrives and how a reply
 * goes out, so both hand their input to this and get the same behaviour. A fix
 * made here reaches both.
 *
 * `ctx` is { channel, senderId, send(text), sendTyping?() }.
 * `input` is { text?, imageBase64?, mimeType?, isVoice? }.
 */
export async function handleMessage(ctx, input) {
  const session = getSession(ctx.senderId);
  const senderRef = String(ctx.senderId);

  try {
    if (input.isVoice) return ctx.send(VOICE_UNSUPPORTED);

    /* --- Images ---------------------------------------------------- */
    if (input.imageBase64) {
      await ctx.send(IMAGE_ANALYSING);
      return runCheck(ctx, session, senderRef, {
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        label: "screenshot",
      });
    }

    const text = String(input.text || "").trim();
    if (!text) return;

    const command = readCommand(text);

    /* --- Mid-flow states come first -------------------------------- */
    if (session.step === STEP.DID_YOU_MEAN) {
      const handled = await handleDidYouMean(ctx, session, senderRef, text);
      if (handled) return;
      // Not a menu choice: fall through and treat it as a fresh question.
    }

    if (session.step.startsWith("REPORT")) {
      if (command === "cancel") {
        reset(session);
        return ctx.send("Report cancelled. Send any name, number or link whenever you want a check.");
      }
      return handleReport(ctx, session, senderRef, text);
    }

    /* --- Commands --------------------------------------------------- */
    if (command === "report") {
      setStep(session, STEP.REPORT_NAME);
      session.draft = {};
      return ctx.send("What is the name of the company or platform you want to report?");
    }

    if (command === "help") {
      markGreeted(session);
      return ctx.send(HELP);
    }

    if (command === "cancel") {
      reset(session);
      return ctx.send("Nothing to cancel. Send any name, number or link to check it.");
    }

    /* --- Anything else is something to check ------------------------ */
    const query = extractQuery(text);
    if (!query) return;

    return runCheck(ctx, session, senderRef, { ...query, label: query.text });
  } catch (err) {
    console.error(`[bot] handling failed: ${err.message}`);
    return ctx.send(GENERIC_ERROR);
  }
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

async function runCheck(ctx, session, senderRef, { text, urls, recipient, type, imageBase64, mimeType, label }) {
  await ctx.sendTyping?.();

  const result = await check({
    channel: ctx.channel,
    senderRef,
    text,
    urls,
    recipient,
    type,
    imageBase64,
    mimeType,
  });

  if (!result.ok) {
    if (result.code === "daily_limit") return ctx.send(DAILY_LIMIT);
    if (result.code === "invalid_input" && imageBase64) return ctx.send(IMAGE_NO_NAME);
    if (result.code === "invalid_input") {
      return ctx.send("I couldn't read that. Send a company name, phone number, link, or a screenshot.");
    }
    return ctx.send(GENERIC_ERROR);
  }

  // A name close to a registered one: ask which was meant before saying anything.
  if (result.did_you_mean) {
    session.draft = { original: result.did_you_mean.original_query || label, suggested: result.did_you_mean.suggested_entity };
    setStep(session, STEP.DID_YOU_MEAN);
    return ctx.send(prefixWelcome(session, buildDidYouMean(result)));
  }

  // An image that yielded nothing to check.
  if (imageBase64 && !result.match && !result.entity && result.state === "no_record" && !result.report?.sources?.length) {
    const extracted = result.report?.also_checked?.length;
    if (!extracted) return ctx.send(prefixWelcome(session, IMAGE_NO_NAME));
  }

  return ctx.send(prefixWelcome(session, buildReply(result, { query: label })));
}

async function handleDidYouMean(ctx, session, senderRef, text) {
  const choice = text.trim();
  const { original, suggested } = session.draft || {};

  if (choice === "1" && suggested) {
    reset(session);
    await runCheck(ctx, session, senderRef, { text: suggested, label: suggested });
    return true;
  }

  if (choice === "2" && original) {
    reset(session);
    // Asked and answered — send it as an exact name so the backend does not
    // ask the same question again.
    await runCheck(ctx, session, senderRef, { text: original, recipient: original, type: "name", label: original });
    return true;
  }

  if (/^\d+$/.test(choice)) {
    await ctx.send(`Please reply *1* for *${suggested}* or *2* for *${original}*.`);
    return true;
  }

  reset(session);
  return false;
}

/* ------------------------------------------------------------------ *
 * Report flow
 * ------------------------------------------------------------------ */

async function handleReport(ctx, session, senderRef, text) {
  if (session.step === STEP.REPORT_NAME) {
    session.draft.schemeName = text.slice(0, 200);
    setStep(session, STEP.REPORT_DETAILS);
    return ctx.send(
      `Thanks. What happened with "${session.draft.schemeName}"?\n\n` +
        `If you have a link to their website, advert or group, paste it here — a link is what a reviewer can actually check.\n\n` +
        `Reply *SKIP* if you have none.`
    );
  }

  if (session.step === STEP.REPORT_DETAILS) {
    session.draft.details = /^skip$/i.test(text) ? "" : text.slice(0, 1000);
    setStep(session, STEP.REPORT_CONFIRM);
    return ctx.send(
      `I'll submit a report about "${session.draft.schemeName}". A person will review it, and it may help protect others.\n\nConfirm? Reply *YES* or *NO*.`
    );
  }

  if (session.step === STEP.REPORT_CONFIRM) {
    if (!/^(yes|y)$/i.test(text)) {
      reset(session);
      return ctx.send('Report cancelled. You can start again anytime by sending "REPORT".');
    }

    const { schemeName, details } = session.draft;
    reset(session);

    // Only links go up as evidence. The public report has no field for a
    // narrative, so the description is used to pull out any links the person
    // included and is otherwise not sent — better than posting prose into a
    // URL field, and better than pretending we filed their account of it.
    const evidenceUrls = findUrls(details).slice(0, 5);

    const res = await submitReport({
      channel: ctx.channel,
      senderRef,
      schemeName,
      // The name is the only identifier a chat gives us. The backend hashes
      // it; the person's own number is never sent as evidence.
      identifiers: [{ type: "name", value: schemeName }],
      evidenceUrls,
    });

    if (!res.ok) {
      if (res.code === "daily_limit") return ctx.send(DAILY_LIMIT);
      return ctx.send(GENERIC_ERROR);
    }

    return ctx.send(
      "✅ Report submitted. Thank you for helping protect others — a person will review it.\n\n" +
        "If you're at risk of losing money now, call SEC Ghana: 0800 100 065."
    );
  }
}

/* ------------------------------------------------------------------ */

/** The privacy line goes out once, ahead of that sender's first reply. */
function prefixWelcome(session, body) {
  return markGreeted(session) ? welcomeBlock() + "\n" + body : body;
}
