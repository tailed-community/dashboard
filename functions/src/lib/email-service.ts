import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import { buildJobDetailUrl } from "./links";
import type { DigestJob } from "./jobs-feed";
import type { Locale } from "./locale";

dotenv.config();

const server = process.env.EMAIL_SERVER;

const transport = createTransport(server);

/* ---------------------------------------------------------------------------
 * Shared email design system — "Warm Community".
 * Cream canvas, centered hosted logo, soft white cards, dark non-profit CTA
 * panel. The logo uses the hosted PNG (inline SVG is stripped by Gmail et al.).
 * Used by the student-facing emails (welcome, digest, community, event).
 * ------------------------------------------------------------------------- */
const EMAIL_SITE_URL = (
  process.env.FRONTEND_URL || "https://community.tailed.ca"
).replace(/\/+$/, "");
const EMAIL_LOGO_URL = `${EMAIL_SITE_URL}/Tailed_Community_logo.png`;
const EMAIL_FONT = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
const EMAIL_DOT = `<span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:#EB7A24;vertical-align:middle;margin-right:10px;"></span>`;
const EMAIL_SOCIAL: Array<[string, string]> = [
  ["YouTube", "https://www.youtube.com/@tailedcommunity"],
  ["Instagram", "https://www.instagram.com/tailed.community"],
  ["Discord", "https://discord.gg/gpbtFXTgNQ"],
  ["GitHub", "https://github.com/tailed-community"],
];

function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#EB7A24;color:#ffffff;font:700 15px ${EMAIL_FONT};text-decoration:none;padding:14px 34px;border-radius:999px;box-shadow:0 4px 10px rgba(235,122,36,0.25);">${label}</a>`;
}

function emailHeader(kicker: string, title: string, subtitle: string): string {
  return `
        <tr><td align="center" style="padding:30px 30px 0;">
          <img src="${EMAIL_LOGO_URL}" alt="Tail'ed" height="34" style="height:34px;width:auto;display:block;border:0;margin:0 auto;" />
        </td></tr>
        <tr><td align="center" style="padding:18px 34px 4px;">
          ${kicker ? `<div style="font:700 12px ${EMAIL_FONT};letter-spacing:0.1em;text-transform:uppercase;color:#A18B6D;margin-bottom:8px;">${kicker}</div>` : ""}
          <div style="font:800 25px/1.25 ${EMAIL_FONT};color:#2F1E02;letter-spacing:-0.01em;">${title}</div>
          ${subtitle ? `<div style="font:400 15px/1.6 ${EMAIL_FONT};color:#836E51;margin-top:10px;max-width:430px;display:inline-block;">${subtitle}</div>` : ""}
        </td></tr>`;
}

function emailDarkPanel(
  title: string,
  body: string,
  href: string,
  cta: string
): string {
  return `
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#170700;border-radius:24px;">
            <tr><td align="center" style="padding:30px;">
              <div style="font:800 19px ${EMAIL_FONT};color:#ffffff;">${title}</div>
              <div style="font:400 14px/1.6 ${EMAIL_FONT};color:#C1AA8B;margin-top:8px;">${body}</div>
              <div style="margin-top:16px;"><a href="${href}" style="display:inline-block;background:#EB7A24;color:#ffffff;font:700 13px ${EMAIL_FONT};text-decoration:none;padding:11px 26px;border-radius:999px;">${cta}</a></div>
            </td></tr>
          </table>
        </td></tr>`;
}

const FOOTER_STRINGS: Record<
  Locale,
  { unsubscribe: string; questions: string; rights: string }
> = {
  en: {
    unsubscribe: "Unsubscribe",
    questions: "Questions?",
    rights: "All rights reserved.",
  },
  fr: {
    unsubscribe: "Se d&eacute;sabonner",
    questions: "Des questions&nbsp;?",
    rights: "Tous droits r&eacute;serv&eacute;s.",
  },
};

function emailFooter(
  consentLine: string,
  unsubscribeUrl?: string,
  locale: Locale = "en"
): string {
  const t = FOOTER_STRINGS[locale];
  const social = EMAIL_SOCIAL.map(
    ([name, url]) =>
      `<a href="${url}" style="color:#B4661F;text-decoration:none;margin:0 8px;">${name}</a>`
  ).join("&middot;");
  const unsub = unsubscribeUrl
    ? `<div style="margin-bottom:12px;"><a href="${unsubscribeUrl}" style="color:#B4661F;text-decoration:underline;">${t.unsubscribe}</a></div>`
    : "";
  return `
        <tr><td style="padding:26px 24px 34px;text-align:center;font:400 12px/1.7 ${EMAIL_FONT};color:#A18B6D;">
          <div style="margin-bottom:14px;">${social}</div>
          <div style="color:#2F1E02;font-weight:700;margin-bottom:4px;">Tail'ed Community</div>
          <div style="margin-bottom:12px;">${consentLine}</div>
          ${unsub}
          <div style="color:#A18B6D;font-size:11px;line-height:1.6;">
            Tail'ed Community &middot; Montr&eacute;al, QC, Canada<br />
            ${t.questions} <a href="mailto:community@tailed.ca" style="color:#B4661F;">community@tailed.ca</a>
            &nbsp;&middot;&nbsp; &copy; ${new Date().getFullYear()} Tail'ed. ${t.rights}
          </div>
        </td></tr>`;
}

function emailShell(preheaderText: string, innerRows: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#F4EDE3;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheaderText}</div>
    <div style="padding:24px 12px;">
      <table align="center" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;margin:0 auto;background:#FEF9F3;border-radius:24px;overflow:hidden;">
        ${innerRows}
      </table>
    </div>
  </body>
</html>`;
}

/**
 * Send verification email to user. Student-facing → bilingual; `locale`
 * defaults to "en" so any caller that doesn't resolve a language stays safe.
 */
const VERIFICATION_CONTENT: Record<
  Locale,
  {
    subject: string;
    heading: string;
    intro: string;
    cta: string;
    ignore: string;
    expiry: string;
    text: (link: string) => string;
  }
> = {
  en: {
    subject: "Verify your email address",
    heading: "Welcome to Tail'ed!",
    intro: "Please verify your email address by clicking the link below:",
    cta: "Verify Email",
    ignore: "If you didn't create an account with us, you can ignore this email.",
    expiry: "The link will expire in 24 hours.",
    text: (link) =>
      `Welcome to Tail'ed! Please verify your email address by clicking this link: ${link}`,
  },
  fr: {
    subject: "Confirme ton adresse courriel",
    heading: "Bienvenue sur Tail'ed !",
    intro: "Confirme ton adresse courriel en cliquant sur le lien ci-dessous :",
    cta: "Confirmer mon courriel",
    ignore:
      "Si tu n'as pas créé de compte chez nous, tu peux ignorer ce courriel.",
    expiry: "Le lien expirera dans 24 heures.",
    text: (link) =>
      `Bienvenue sur Tail'ed ! Confirme ton adresse courriel en cliquant sur ce lien : ${link}`,
  },
};

export const sendVerificationEmail = async (
  email: string,
  verificationLink: string,
  locale: Locale = "en"
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${email} params: ${JSON.stringify({ verificationLink })}`
    );
    return Promise.resolve();
  }

  const c = VERIFICATION_CONTENT[locale];
  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: c.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${c.heading}</h2>
        <p>${c.intro}</p>
        <p>
          <a
            href="${verificationLink}"
            style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;"
          >
            ${c.cta}
          </a>
        </p>
        <p>${c.ignore}</p>
        <p>${c.expiry}</p>
      </div>
    `,
    text: c.text(verificationLink),
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send organization invitation email
 */
export const sendInvitationEmail = async (
  email: string,
  organizationName: string,
  inviterName: string,
  inviteLink: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${email} params: ${JSON.stringify({
        inviteLink,
        organizationName,
        inviterName,
      })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: `You've been invited to join ${organizationName} on Tail'ed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${organizationName}</h2>
        <p>${inviterName} has invited you to join their organization on Tail'ed.</p>
        <p>To accept this invitation, please click the link below:</p>
        <p>
          <a 
            href="${inviteLink}" 
            style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;"
          >
            Accept Invitation
          </a>
        </p>
        <p>This invitation link will expire in 7 days.</p>
        <p>If you weren't expecting this invitation, you can ignore this email.</p>
      </div>
    `,
    text: `You've been invited to join ${organizationName} on Tail'ed. ${inviterName} has invited you to join their organization. To accept this invitation, please click this link: ${inviteLink}`,
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send job application invitation email
 */
export const sendJobApplicationInviteEmail = async (
  email: string,
  organizationName: string,
  jobTitle: string,
  applicationLink: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${email} params: ${JSON.stringify({
        applicationLink,
        organizationName,
        jobTitle,
      })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: `You're invited to apply for ${jobTitle} at ${organizationName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're invited to apply for ${jobTitle}</h2>
        <p>${organizationName} has invited you to apply for the ${jobTitle} position.</p>
        <p>To complete your application, please click the link below:</p>
        <p>
          <a 
            href="${applicationLink}" 
            style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;"
          >
            Complete Application
          </a>
        </p>
        <p>This application link will expire in 30 days.</p>
      </div>
    `,
    text: `You're invited to apply for ${jobTitle} at ${organizationName}. To complete your application, please click this link: ${applicationLink}`,
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send job application confirmation email
 */
export const sendJobApplicationConfirmationEmail = async (
  email: string,
  jobTitle: string,
  organizationName: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${email} params: ${JSON.stringify({
        jobTitle,
        organizationName,
      })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: `Your application for ${jobTitle} at ${organizationName} has been received`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Received</h2>
        <p>Thank you for applying for the ${jobTitle} position at ${organizationName}.</p>
        <p>We have received your application and it is now under review.</p>
        <p>We'll contact you if your qualifications match our requirements.</p>
      </div>
    `,
    text: `Thank you for applying for the ${jobTitle} position at ${organizationName}. We have received your application and it is now under review. We'll contact you if your qualifications match our requirements.`,
  };

  return transport.sendMail(mailOptions);
};

/**
 * Sends a notification email to administrators
 * @param to Email address to send to
 * @param subject Email subject
 * @param htmlContent Email body in HTML format
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${to} params: ${JSON.stringify({ subject, htmlContent })}`
    );
    return Promise.resolve();
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
      sender: "no-reply@tailed.ca",
      to,
      subject,
      html: `
        <div style="
          font-family: Arial, sans-serif; 
          max-width: 600px; 
          margin: 0 auto; 
          border: 1px solid #eaeaea; 
          border-radius: 5px; 
          overflow: hidden;
        ">
          <div style="
            background-color: #f8f8f8; 
            padding: 20px; 
            border-bottom: 1px solid #eaeaea; 
            text-align: center;
          ">
            <h1 style="
              color: #333; 
              margin: 0; 
              font-size: 24px;
            ">Tail'ed</h1>
          </div>
          <div style="
            padding: 20px;
          ">
            <h2 style="
              color: #444; 
              margin-top: 0;
            ">${subject}</h2>
            <div style="
              color: #555; 
              line-height: 1.5; 
              margin-bottom: 20px;
            ">${htmlContent}</div>
          </div>
          <div style="
            background-color: #f8f8f8; 
            padding: 15px; 
            text-align: center; 
            font-size: 12px; 
            color: #777; 
            border-top: 1px solid #eaeaea;
          ">
            <p style="margin: 0;">© ${new Date().getFullYear()} Tail'ed. All rights reserved.</p>
            <p style="margin: 5px 0 0;">If you have any questions, please contact us at support@tailed.ca</p>
          </div>
        </div>
      `,
      text: htmlContent.replace(/<[^>]*>/g, ""), // Strip HTML tags for plain text version
    };

    await transport.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending notification email:", error);
    throw error;
  }
}

// Add the sendEmail function if it doesn't exist already

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${to} params: ${JSON.stringify({ subject, html, text })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags if text is not provided
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send welcome email when a new account is created via community import.
 * Student-facing → bilingual; `locale` defaults to "en".
 */
interface CommunityWelcomeCopy {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  welcomeWithEvent: (eventTitle: string, communityName: string) => string;
  welcomeNoEvent: (communityName: string) => string;
  welcomeWithEventText: (eventTitle: string, communityName: string) => string;
  welcomeNoEventText: (communityName: string) => string;
  lead: (name: string) => string;
  bullets: string[];
  cta: string;
  darkTitle: string;
  darkBody: string;
  darkCta: string;
  footerLine: string;
  greetingName: string;
  bulletsText: string[];
  exploreText: string;
}

const COMMUNITY_WELCOME_CONTENT: Record<Locale, CommunityWelcomeCopy> = {
  en: {
    subject: "Welcome to Tail'ed Community!",
    preheader: "Your Tail'ed Community account is ready.",
    kicker: "Welcome aboard",
    title: "Welcome to Tail'ed.",
    welcomeWithEvent: (eventTitle, communityName) =>
      `Great news! You've been registered for <strong style="color: #EB7A24;">${eventTitle}</strong> through <strong style="color: #EB7A24;">${communityName}</strong> on Tail'ed Community.`,
    welcomeNoEvent: (communityName) =>
      `Great news! You've been added to <strong style="color: #EB7A24;">${communityName}</strong> on Tail'ed Community.`,
    welcomeWithEventText: (eventTitle, communityName) =>
      `Great news! You've been registered for ${eventTitle} through ${communityName} on Tail'ed Community.`,
    welcomeNoEventText: (communityName) =>
      `Great news! You've been added to ${communityName} on Tail'ed Community.`,
    lead: (name) =>
      `Hi <strong>${name}</strong> — here's what you can do with your new account:`,
    bullets: [
      "Browse thousands of new-grad &amp; internship roles, updated daily.",
      "Set job alerts and get matches straight to your inbox.",
      "Join events, hacknights, and your campus community.",
    ],
    cta: "Access your account",
    darkTitle: "Find your people",
    darkBody:
      "Tail'ed Community is a non-profit student community. Join your campus and meet others on the same journey.",
    darkCta: "Explore communities",
    footerLine:
      "An account was created for you at community.tailed.ca. This is a one-time account notification.",
    greetingName: "there",
    bulletsText: [
      "Browse thousands of new-grad & internship roles, updated daily.",
      "Set job alerts and get matches straight to your inbox.",
      "Join events, hacknights, and your campus community.",
    ],
    exploreText: "Explore communities",
  },
  fr: {
    subject: "Bienvenue dans Tail'ed Community !",
    preheader: "Ton compte Tail'ed Community est prêt.",
    kicker: "Bienvenue à bord",
    title: "Bienvenue sur Tail'ed.",
    welcomeWithEvent: (eventTitle, communityName) =>
      `Bonne nouvelle ! Tu as été inscrit(e) à <strong style="color: #EB7A24;">${eventTitle}</strong> par l'entremise de <strong style="color: #EB7A24;">${communityName}</strong> sur Tail'ed Community.`,
    welcomeNoEvent: (communityName) =>
      `Bonne nouvelle ! Tu as été ajouté(e) à <strong style="color: #EB7A24;">${communityName}</strong> sur Tail'ed Community.`,
    welcomeWithEventText: (eventTitle, communityName) =>
      `Bonne nouvelle ! Tu as été inscrit(e) à ${eventTitle} par l'entremise de ${communityName} sur Tail'ed Community.`,
    welcomeNoEventText: (communityName) =>
      `Bonne nouvelle ! Tu as été ajouté(e) à ${communityName} sur Tail'ed Community.`,
    lead: (name) =>
      `Salut <strong>${name}</strong> — voici ce que tu peux faire avec ton nouveau compte :`,
    bullets: [
      "Parcours des milliers de postes pour nouveaux diplômés &amp; stages, mis à jour chaque jour.",
      "Crée des alertes d'emploi et reçois tes matchs directement dans ta boîte courriel.",
      "Participe à des événements, des hacknights et à ta communauté de campus.",
    ],
    cta: "Accéder à mon compte",
    darkTitle: "Trouve les tiens",
    darkBody:
      "Tail'ed Community est une communauté étudiante à but non lucratif. Rejoins ton campus et rencontre d'autres personnes qui vivent le même parcours.",
    darkCta: "Explorer les communautés",
    footerLine:
      "Un compte a été créé pour toi sur community.tailed.ca. Ceci est un avis de compte unique.",
    greetingName: "toi",
    bulletsText: [
      "Parcours des milliers de postes pour nouveaux diplômés et stages, mis à jour chaque jour.",
      "Crée des alertes d'emploi et reçois tes matchs directement dans ta boîte courriel.",
      "Participe à des événements, des hacknights et à ta communauté de campus.",
    ],
    exploreText: "Explorer les communautés",
  },
};

export const sendCommunityWelcomeEmail = async (
  email: string,
  firstName: string,
  communityName: string,
  eventTitle: string | null | undefined,
  loginLink: string,
  locale: Locale = "en"
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Welcome email sent to ${email} params: ${JSON.stringify({
        firstName,
        communityName,
        eventTitle,
        loginLink,
      })}`
    );
    return Promise.resolve();
  }

  const c = COMMUNITY_WELCOME_CONTENT[locale];

  // Dynamic message based on whether event is provided
  const welcomeMessage = eventTitle
    ? c.welcomeWithEvent(eventTitle, communityName)
    : c.welcomeNoEvent(communityName);

  const welcomeMessageText = eventTitle
    ? c.welcomeWithEventText(eventTitle, communityName)
    : c.welcomeNoEventText(communityName);

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: c.subject,
    html: emailShell(
      c.preheader,
      emailHeader(c.kicker, c.title, welcomeMessage) +
        `
        <tr><td align="center" style="padding:22px 30px 2px;">
          <div style="font:400 15px/1.65 ${EMAIL_FONT};color:#2A1F1A;">${c.lead(
            escapeHtml(firstName || c.greetingName)
          )}</div>
        </td></tr>
        <tr><td style="padding:16px 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${c.bullets
              .map(
                (t) =>
                  `<tr><td style="padding:0 0 12px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);"><tr><td style="padding:15px 18px;font:400 14px/1.5 ${EMAIL_FONT};color:#2A1F1A;">${EMAIL_DOT}${t}</td></tr></table></td></tr>`
              )
              .join("")}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 28px;">${emailButton(
          loginLink,
          c.cta
        )}</td></tr>` +
        emailDarkPanel(
          c.darkTitle,
          c.darkBody,
          `${EMAIL_SITE_URL}/communities`,
          c.darkCta
        ) +
        emailFooter(c.footerLine, undefined, locale)
    ),
    text: `${c.subject}

${locale === "fr" ? "Salut" : "Hi"} ${firstName || c.greetingName},

${welcomeMessageText}

${c.cta}: ${loginLink}

${c.bulletsText.map((t) => `- ${t}`).join("\n")}

${c.exploreText}: ${EMAIL_SITE_URL}/communities

${locale === "fr" ? "Des questions ? Écris-nous à" : "Questions? Contact us at"} community@tailed.ca
© ${new Date().getFullYear()} Tail'ed Community. ${
      locale === "fr" ? "Tous droits réservés." : "All rights reserved."
    }`,
  };
  return transport.sendMail(mailOptions);
};

/**
 * Send an approval email when an event organizer confirms a participation
 * request. Student-facing → bilingual; `locale` defaults to "en".
 */
interface EventApprovalCopy {
  subject: (eventTitle: string) => string;
  preheader: string;
  kicker: string;
  title: string;
  subtitle: (eventTitle: string) => string;
  lead: (name: string) => string;
  cardNote: string;
  cta: string;
  darkTitle: string;
  darkBody: string;
  darkCta: string;
  footerLine: string;
  greetingName: string;
  text: (name: string, eventTitle: string, eventLink: string) => string;
}

const EVENT_APPROVAL_CONTENT: Record<Locale, EventApprovalCopy> = {
  en: {
    subject: (eventTitle) => `Your request to join ${eventTitle} has been approved`,
    preheader: "Your event registration was approved.",
    kicker: "You're approved",
    title: "You're in.",
    subtitle: (eventTitle) =>
      `Your request to join <strong style="color:#EB7A24;">${escapeHtml(
        eventTitle
      )}</strong> was approved by the organizer.`,
    lead: (name) =>
      `Hi <strong>${name}</strong>, you can now access the event page and any event-specific experiences from your Tail'ed Community dashboard.`,
    cardNote:
      "You're on the list. See timing, location and details on the event page.",
    cta: "View event details",
    darkTitle: "More happening on Tail'ed",
    darkBody:
      "Discover other events, hacknights and student communities near you.",
    darkCta: "Explore events &amp; communities",
    footerLine:
      "You're receiving this because you registered for an event on community.tailed.ca.",
    greetingName: "there",
    text: (name, eventTitle, eventLink) =>
      `Hi ${name},\n\nYour request to join ${eventTitle} has been approved by the organizer.\n\nView the event: ${eventLink}\n\nMore happening on Tail'ed: ${EMAIL_SITE_URL}/events\n\n© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: (eventTitle) => `Ta demande pour rejoindre ${eventTitle} a été approuvée`,
    preheader: "Ton inscription à l'événement a été approuvée.",
    kicker: "C'est approuvé",
    title: "Tu es de la partie.",
    subtitle: (eventTitle) =>
      `Ta demande pour rejoindre <strong style="color:#EB7A24;">${escapeHtml(
        eventTitle
      )}</strong> a été approuvée par l'organisateur.`,
    lead: (name) =>
      `Salut <strong>${name}</strong>, tu peux maintenant accéder à la page de l'événement et à toutes les expériences propres à l'événement depuis ton tableau de bord Tail'ed Community.`,
    cardNote:
      "Tu es sur la liste. Consulte l'horaire, le lieu et les détails sur la page de l'événement.",
    cta: "Voir les détails de l'événement",
    darkTitle: "Encore plus sur Tail'ed",
    darkBody:
      "Découvre d'autres événements, hacknights et communautés étudiantes près de chez toi.",
    darkCta: "Explorer les événements &amp; communautés",
    footerLine:
      "Tu reçois ce courriel parce que tu t'es inscrit(e) à un événement sur community.tailed.ca.",
    greetingName: "toi",
    text: (name, eventTitle, eventLink) =>
      `Salut ${name},\n\nTa demande pour rejoindre ${eventTitle} a été approuvée par l'organisateur.\n\nVoir l'événement : ${eventLink}\n\nEncore plus sur Tail'ed : ${EMAIL_SITE_URL}/events\n\n© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendEventApprovalEmail = async (
  email: string,
  firstName: string,
  eventTitle: string,
  eventLink: string,
  locale: Locale = "en"
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Approval email sent to ${email} params: ${JSON.stringify({
        firstName,
        eventTitle,
        eventLink,
      })}`
    );
    return Promise.resolve();
  }

  const c = EVENT_APPROVAL_CONTENT[locale];

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: c.subject(eventTitle),
    html: emailShell(
      c.preheader,
      emailHeader(c.kicker, c.title, c.subtitle(eventTitle)) +
        `
        <tr><td align="center" style="padding:22px 30px 2px;">
          <div style="font:400 15px/1.65 ${EMAIL_FONT};color:#2A1F1A;">${c.lead(
            escapeHtml(firstName || c.greetingName)
          )}</div>
        </td></tr>
        <tr><td style="padding:20px 24px 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr><td style="padding:20px 22px;">
              <div style="font:800 18px/1.3 ${EMAIL_FONT};color:#2F1E02;">${escapeHtml(
                eventTitle
              )}</div>
              <div style="font:400 13px/1.5 ${EMAIL_FONT};color:#836E51;margin-top:6px;">${c.cardNote}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 24px 28px;">${emailButton(
          eventLink,
          c.cta
        )}</td></tr>` +
        emailDarkPanel(
          c.darkTitle,
          c.darkBody,
          `${EMAIL_SITE_URL}/events`,
          c.darkCta
        ) +
        emailFooter(c.footerLine, undefined, locale)
    ),
    text: c.text(firstName || c.greetingName, eventTitle, eventLink),
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send a welcome/confirmation email when a student subscribes to job alerts
 * (WS4 email capture). Confirms what they'll get and includes the
 * unsubscribe link — this is the only confirmation step for v1 (no
 * double opt-in; see docs/specs/04-email-capture.md "Out of scope").
 */
interface JobAlertWelcomeCopy {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  subtitle: (whatLine: string) => string;
  whatLine: (query: string | null | undefined) => string;
  whatLineText: (query: string | null | undefined) => string;
  bullets: string[];
  cta: string;
  accountDarkTitle: string;
  accountDarkBody: string;
  accountDarkCta: string;
  discoverDarkTitle: string;
  discoverDarkBody: string;
  discoverDarkCta: string;
  footerLine: (query: string | null | undefined) => string;
  text: (args: {
    whatLineText: string;
    signInUrl: string | undefined;
    unsubscribeUrl: string;
  }) => string;
}

const JOB_ALERT_WELCOME_CONTENT: Record<Locale, JobAlertWelcomeCopy> = {
  en: {
    subject: "You're in — daily job alerts from Tail'ed",
    preheader: "You're subscribed to Tail'ed Community job alerts.",
    kicker: "You're subscribed",
    title: "You're in.",
    subtitle: (whatLine) =>
      `You'll now get ${whatLine} delivered to your inbox each morning — free, forever, no spam.`,
    whatLine: (query) =>
      query
        ? `new <strong style="color: #EB7A24;">${escapeHtml(query)}</strong> roles`
        : `new internships and new-grad roles`,
    whatLineText: (query) =>
      query ? `new "${query}" roles` : `new internships and new-grad roles`,
    bullets: [
      "One email each morning — only when there are new matches.",
      "Apply straight from the email — links go right to the posting.",
      "Your free Tail'ed account is ready — no password to remember.",
      "Unsubscribe anytime, one click.",
    ],
    cta: "Browse jobs now",
    accountDarkTitle: "Your account is ready",
    accountDarkBody:
      "Sign in with one tap — no password — to edit your alerts, save jobs, and complete your profile.",
    accountDarkCta: "Sign in to Tail'ed",
    discoverDarkTitle: "Discover more on Tail'ed",
    discoverDarkBody:
      "Events, hacknights and student communities near you — meet people and get hired faster.",
    discoverDarkCta: "Explore events &amp; communities",
    footerLine: (query) =>
      `You subscribed to job alerts${
        query ? ` for &quot;${escapeHtml(query)}&quot;` : ""
      } on community.tailed.ca.`,
    text: ({ whatLineText, signInUrl, unsubscribeUrl }) =>
      `You're in!\n\nYou'll now get ${whatLineText} delivered to your inbox each morning — free, forever, no spam.\n\nBrowse jobs now: ${EMAIL_SITE_URL}/jobs\n${
        signInUrl
          ? `\nYour free Tail'ed account is ready. Sign in (no password) to edit your alerts and complete your profile:\n${signInUrl}\n`
          : ""
      }\nYour first digest lands as soon as there are fresh matches.\n\nUnsubscribe: ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Ça y est — tes alertes d'emploi quotidiennes de Tail'ed",
    preheader: "Tu es abonné(e) aux alertes d'emploi de Tail'ed Community.",
    kicker: "Abonnement confirmé",
    title: "Ça y est.",
    subtitle: (whatLine) =>
      `Tu recevras désormais ${whatLine} directement dans ta boîte courriel chaque matin — gratuit, pour toujours, sans pourriel.`,
    whatLine: (query) =>
      query
        ? `de nouveaux postes <strong style="color: #EB7A24;">${escapeHtml(
            query
          )}</strong>`
        : `de nouveaux stages et postes pour nouveaux diplômés`,
    whatLineText: (query) =>
      query
        ? `de nouveaux postes « ${query} »`
        : `de nouveaux stages et postes pour nouveaux diplômés`,
    bullets: [
      "Un seul courriel chaque matin — uniquement quand il y a de nouveaux matchs.",
      "Postule directement depuis le courriel — les liens mènent droit à l'offre.",
      "Ton compte Tail'ed gratuit est prêt — aucun mot de passe à retenir.",
      "Désabonne-toi quand tu veux, en un clic.",
    ],
    cta: "Parcourir les emplois",
    accountDarkTitle: "Ton compte est prêt",
    accountDarkBody:
      "Connecte-toi en un clic — sans mot de passe — pour modifier tes alertes, sauvegarder des offres et compléter ton profil.",
    accountDarkCta: "Se connecter à Tail'ed",
    discoverDarkTitle: "Découvre-en plus sur Tail'ed",
    discoverDarkBody:
      "Des événements, des hacknights et des communautés étudiantes près de chez toi — rencontre du monde et fais-toi embaucher plus vite.",
    discoverDarkCta: "Explorer les événements &amp; communautés",
    footerLine: (query) =>
      `Tu t'es abonné(e) aux alertes d'emploi${
        query ? ` pour &quot;${escapeHtml(query)}&quot;` : ""
      } sur community.tailed.ca.`,
    text: ({ whatLineText, signInUrl, unsubscribeUrl }) =>
      `Ça y est !\n\nTu recevras désormais ${whatLineText} directement dans ta boîte courriel chaque matin — gratuit, pour toujours, sans pourriel.\n\nParcourir les emplois : ${EMAIL_SITE_URL}/jobs\n${
        signInUrl
          ? `\nTon compte Tail'ed gratuit est prêt. Connecte-toi (sans mot de passe) pour modifier tes alertes et compléter ton profil :\n${signInUrl}\n`
          : ""
      }\nTon premier résumé arrive dès qu'il y a de nouveaux matchs.\n\nSe désabonner : ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendJobAlertWelcomeEmail = async (
  email: string,
  query: string | null | undefined,
  unsubscribeUrl: string,
  /**
   * One-time sign-in link (generated server-side by buildSignInLink). When
   * present, the email offers one-tap access to the soft account created on
   * capture. Omitted for already-authenticated subscribers.
   */
  signInUrl?: string,
  locale: Locale = "en"
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Job alert welcome email sent to ${email} params: ${JSON.stringify({
        query,
        unsubscribeUrl,
        signInUrl,
      })}`
    );
    return Promise.resolve();
  }

  const c = JOB_ALERT_WELCOME_CONTENT[locale];
  const whatLine = c.whatLine(query);
  const whatLineText = c.whatLineText(query);

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: c.subject,
    html: emailShell(
      c.preheader,
      emailHeader(c.kicker, c.title, c.subtitle(whatLine)) +
        `
        <tr><td style="padding:22px 30px 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${c.bullets
              .map(
                (t) =>
                  `<tr><td style="padding:7px 0;font:400 14px/1.5 ${EMAIL_FONT};color:#2A1F1A;">${EMAIL_DOT}${t}</td></tr>`
              )
              .join("")}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 26px;">${emailButton(
          `${EMAIL_SITE_URL}/jobs`,
          c.cta
        )}</td></tr>` +
        (signInUrl
          ? emailDarkPanel(
              c.accountDarkTitle,
              c.accountDarkBody,
              signInUrl,
              c.accountDarkCta
            )
          : emailDarkPanel(
              c.discoverDarkTitle,
              c.discoverDarkBody,
              `${EMAIL_SITE_URL}/events`,
              c.discoverDarkCta
            )) +
        emailFooter(c.footerLine(query), unsubscribeUrl, locale)
    ),
    text: c.text({ whatLineText, signInUrl, unsubscribeUrl }),
  };

  return transport.sendMail(mailOptions);
};

/* ---------------------------------------------------------------------------
 * Onboarding drip templates (spec 08 §7). Six senders, one CTA each, all
 * rendered with the "Warm Community" helpers above. Every CTA deep-links via a
 * one-time sign-in URL built by the caller (buildSignInLink). Functional steps
 * (welcome/profile/community/event) are upbeat & value-framed; sensitive steps
 * (values/selfid) are why-first, state anonymity + voluntariness IN THE BODY
 * before the click, use a soft CTA, and carry NO urgency / FOMO / countdown.
 *
 * NOTE (FR follow-up — spec §5/§8): copy below is EN only. French translations
 * of every onboarding email are a flagged build task, deferred here.
 *
 * Every sender honors the NODE_ENV=development console.log short-circuit, so
 * nothing is actually sent in dev.
 * ------------------------------------------------------------------------- */

/** Shared body-card used to state reassurance copy before a sensitive CTA. */
function emailSoftNote(html: string): string {
  return `
        <tr><td style="padding:6px 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr><td style="padding:18px 20px;font:400 13px/1.65 ${EMAIL_FONT};color:#5B4A36;">${html}</td></tr>
          </table>
        </td></tr>`;
}

interface OnboardingEmailContent {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** greeting / lead paragraph (HTML, already escaped where needed) */
  intro: string;
  /** optional value bullets (functional steps) */
  bullets?: string[];
  /** optional reassurance note rendered before the CTA (sensitive steps) */
  softNote?: string;
  ctaUrl: string;
  ctaLabel: string;
  footerLine: string;
  /** plain-text fallback body */
  text: string;
}

function renderOnboardingEmail(
  c: OnboardingEmailContent,
  locale: Locale
): string {
  const bulletsRow = c.bullets?.length
    ? `
        <tr><td style="padding:16px 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${c.bullets
              .map(
                (t) =>
                  `<tr><td style="padding:7px 0;font:400 14px/1.5 ${EMAIL_FONT};color:#2A1F1A;">${EMAIL_DOT}${t}</td></tr>`
              )
              .join("")}
          </table>
        </td></tr>`
    : "";

  return emailShell(
    c.preheader,
    emailHeader(c.kicker, c.title, c.subtitle) +
      `
        <tr><td align="center" style="padding:22px 30px 2px;">
          <div style="font:400 15px/1.65 ${EMAIL_FONT};color:#2A1F1A;">${c.intro}</div>
        </td></tr>` +
      bulletsRow +
      (c.softNote ? emailSoftNote(c.softNote) : "") +
      `
        <tr><td align="center" style="padding:22px 24px 28px;">${emailButton(
          c.ctaUrl,
          c.ctaLabel
        )}</td></tr>` +
      emailFooter(c.footerLine, undefined, locale)
  );
}

/** Common dev short-circuit + sendMail for every onboarding step. */
async function sendOnboardingEmail(
  email: string,
  step: string,
  content: OnboardingEmailContent,
  locale: Locale
): Promise<unknown> {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Onboarding email (${step}) sent to ${email} params: ${JSON.stringify({
        subject: content.subject,
        ctaUrl: content.ctaUrl,
        locale,
      })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: content.subject,
    html: renderOnboardingEmail(content, locale),
    text: content.text,
  };
  return transport.sendMail(mailOptions);
}

/**
 * Static + interpolated copy for one onboarding step in one locale. `intro`
 * receives the already-escaped first name; `text` receives the raw first name
 * and the CTA URL. Typing each step as `Record<Locale, OnboardingStepCopy>`
 * forces the FR entry to carry every field the EN entry does — FR can't drift.
 */
interface OnboardingStepCopy {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  subtitle: string;
  intro: (name: string) => string;
  bullets?: string[];
  softNote?: string;
  ctaLabel: string;
  footerLine: string;
  greetingName: string;
  text: (name: string, ctaUrl: string) => string;
}

const ONBOARDING_FOOTER: Record<Locale, string> = {
  en: "You're receiving this because you created an account on community.tailed.ca. These onboarding tips stop on their own once you're set up.",
  fr: "Tu reçois ce courriel parce que tu as créé un compte sur community.tailed.ca. Ces conseils de démarrage s'arrêtent d'eux-mêmes une fois que tu es prêt(e).",
};

/** Builds the render-ready content object for a step from its copy + inputs. */
function buildOnboardingContent(
  copy: OnboardingStepCopy,
  firstName: string,
  ctaUrl: string
): OnboardingEmailContent {
  return {
    subject: copy.subject,
    preheader: copy.preheader,
    kicker: copy.kicker,
    title: copy.title,
    subtitle: copy.subtitle,
    intro: copy.intro(escapeHtml(firstName || copy.greetingName)),
    bullets: copy.bullets,
    softNote: copy.softNote,
    ctaUrl,
    ctaLabel: copy.ctaLabel,
    footerLine: copy.footerLine,
    text: copy.text(firstName || copy.greetingName, ctaUrl),
  };
}

/** Step 1 · day 0 · welcome. */
const ONBOARDING_WELCOME_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "Welcome to Tail'ed — let's finish your profile",
    preheader: "The one thing that unlocks matches is a real profile.",
    kicker: "Welcome aboard",
    title: "Welcome to Tail'ed.",
    subtitle:
      "You're in. The single thing that unlocks great job matches is a profile that shows employers who you are.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — glad you're here. Take two minutes to finish your profile so we can start surfacing roles that actually fit you.`,
    bullets: [
      "A real profile is what makes matches accurate.",
      "Add your school, program and grad year to get started.",
      "Everything's optional and you can add more anytime.",
    ],
    ctaLabel: "Finish your profile",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Welcome to Tail'ed!

Hi ${name} — glad you're here. The one thing that unlocks great job matches is a real profile.

Finish your profile: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Bienvenue sur Tail'ed — complétons ton profil",
    preheader: "La seule chose qui débloque les matchs, c'est un vrai profil.",
    kicker: "Bienvenue à bord",
    title: "Bienvenue sur Tail'ed.",
    subtitle:
      "Ça y est. La seule chose qui débloque de bons matchs d'emploi, c'est un profil qui montre aux employeurs qui tu es.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — content de t'avoir parmi nous. Prends deux minutes pour compléter ton profil, qu'on puisse commencer à te proposer des postes qui te correspondent vraiment.`,
    bullets: [
      "Un vrai profil, c'est ce qui rend les matchs précis.",
      "Ajoute ton école, ton programme et ton année de diplomation pour commencer.",
      "Tout est facultatif et tu peux en ajouter quand tu veux.",
    ],
    ctaLabel: "Compléter mon profil",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Bienvenue sur Tail'ed !

Salut ${name} — content de t'avoir parmi nous. La seule chose qui débloque de bons matchs d'emploi, c'est un vrai profil.

Compléter mon profil : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingWelcomeEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "welcome",
    buildOnboardingContent(ONBOARDING_WELCOME_CONTENT[locale], firstName, ctaUrl),
    locale
  );

/** Step 2 · day 3 · profile incomplete or no resume. */
const ONBOARDING_PROFILE_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "Add your details so we can surface the right roles",
    preheader: "New roles match students like you — help us find yours.",
    kicker: "Complete your profile",
    title: "Let's get you matched.",
    subtitle:
      "New internship and new-grad roles land every day. Add your details so we can surface the ones that fit you.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — roles that match students like you come in daily. The more your profile says, the better we can match. Upload a resume or fill in the guided form — whatever's easier.`,
    bullets: [
      "Only your name, school, program and grad year are required.",
      "Drop a resume to pre-fill it, or add details by hand.",
      "Projects and experience help you stand out to employers.",
    ],
    ctaLabel: "Complete your profile",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Hi ${name},

New roles that match students like you land every day. Add your details — upload a resume or use the guided form — so we can surface the right ones.

Complete your profile: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Ajoute tes infos pour qu'on te trouve les bons postes",
    preheader: "De nouveaux postes correspondent à des étudiants comme toi — aide-nous à trouver les tiens.",
    kicker: "Complète ton profil",
    title: "On te trouve des matchs.",
    subtitle:
      "De nouveaux stages et postes pour nouveaux diplômés arrivent chaque jour. Ajoute tes infos pour qu'on te propose ceux qui te correspondent.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — des postes qui correspondent à des étudiants comme toi arrivent tous les jours. Plus ton profil en dit, mieux on peut te matcher. Téléverse un CV ou remplis le formulaire guidé — comme tu préfères.`,
    bullets: [
      "Seuls ton nom, ton école, ton programme et ton année de diplomation sont requis.",
      "Dépose un CV pour préremplir, ou ajoute tes infos à la main.",
      "Tes projets et expériences t'aident à te démarquer auprès des employeurs.",
    ],
    ctaLabel: "Compléter mon profil",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Salut ${name},

De nouveaux postes qui correspondent à des étudiants comme toi arrivent chaque jour. Ajoute tes infos — téléverse un CV ou utilise le formulaire guidé — pour qu'on te propose les bons.

Compléter mon profil : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingProfileEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "profile",
    buildOnboardingContent(ONBOARDING_PROFILE_CONTENT[locale], firstName, ctaUrl),
    locale
  );

/** Step 3 · day 7 · no community joined. */
const ONBOARDING_COMMUNITY_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "Find your people on Tail'ed",
    preheader: "Job hunting is easier with peers on the same journey.",
    kicker: "Get involved",
    title: "You don't have to do this alone.",
    subtitle:
      "Join a community to meet peers on the same journey — share leads, prep together, and find your people.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — the students who get the most out of Tail'ed are the ones who plug into a community. Find one that fits your campus or your interests and say hello.`,
    bullets: [
      "Meet peers going through the same job hunt.",
      "Get referrals, tips, and moral support.",
      "It's free and you can leave anytime.",
    ],
    ctaLabel: "Join a community",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Hi ${name},

Job hunting is easier with peers on the same journey. Join a community to meet people, share leads, and prep together.

Join a community: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Trouve les tiens sur Tail'ed",
    preheader: "La recherche d'emploi est plus facile avec des pairs sur le même parcours.",
    kicker: "Implique-toi",
    title: "Tu n'as pas à faire ça seul(e).",
    subtitle:
      "Rejoins une communauté pour rencontrer des pairs sur le même parcours — partagez des pistes, préparez-vous ensemble et trouve les tiens.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — les étudiants qui tirent le plus de Tail'ed sont ceux qui s'impliquent dans une communauté. Trouves-en une qui correspond à ton campus ou à tes intérêts et fais un petit coucou.`,
    bullets: [
      "Rencontre des pairs qui vivent la même recherche d'emploi.",
      "Obtiens des références, des conseils et du soutien moral.",
      "C'est gratuit et tu peux partir quand tu veux.",
    ],
    ctaLabel: "Rejoindre une communauté",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Salut ${name},

La recherche d'emploi est plus facile avec des pairs sur le même parcours. Rejoins une communauté pour rencontrer du monde, partager des pistes et vous préparer ensemble.

Rejoindre une communauté : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingCommunityEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "community",
    buildOnboardingContent(ONBOARDING_COMMUNITY_CONTENT[locale], firstName, ctaUrl),
    locale
  );

/** Step 4 · day 10 · no event registration. */
const ONBOARDING_EVENT_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "There's an event worth your time",
    preheader: "Low-pressure, high-value — come to one event.",
    kicker: "Get involved",
    title: "Come to an event.",
    subtitle:
      "Career fairs, hacknights and workshops happen often — showing up to one is the easiest way to meet people and get noticed.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — one upcoming event is worth your time. No pressure, no commitment: pick one that looks interesting and RSVP.`,
    bullets: [
      "Meet recruiters and other students in person or online.",
      "Learn something and leave with new connections.",
      "RSVP takes a few seconds.",
    ],
    ctaLabel: "RSVP to an event",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Hi ${name},

There's an upcoming event worth your time — low pressure, high value. Meet people and get noticed.

RSVP to an event: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Il y a un événement qui vaut ton temps",
    preheader: "Sans pression, à forte valeur — viens à un événement.",
    kicker: "Implique-toi",
    title: "Viens à un événement.",
    subtitle:
      "Des salons de l'emploi, des hacknights et des ateliers ont lieu souvent — te présenter à l'un d'eux est la façon la plus simple de rencontrer du monde et de te faire remarquer.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — un événement à venir vaut ton temps. Aucune pression, aucun engagement : choisis-en un qui a l'air intéressant et inscris-toi.`,
    bullets: [
      "Rencontre des recruteurs et d'autres étudiants, en personne ou en ligne.",
      "Apprends quelque chose et repars avec de nouveaux contacts.",
      "L'inscription prend quelques secondes.",
    ],
    ctaLabel: "M'inscrire à un événement",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Salut ${name},

Il y a un événement à venir qui vaut ton temps — sans pression, à forte valeur. Rencontre du monde et fais-toi remarquer.

M'inscrire à un événement : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingEventEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "event",
    buildOnboardingContent(ONBOARDING_EVENT_CONTENT[locale], firstName, ctaUrl),
    locale
  );

/**
 * Step 5 · day 14 · workplace-values survey (SENSITIVE, pillar 4).
 * Why-first, states it's optional, soft CTA, no urgency. At most once.
 */
const ONBOARDING_VALUES_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "What matters to you in an employer?",
    preheader: "Optional — helps us match you to employers who fit you.",
    kicker: "When you're ready",
    title: "What do you value at work?",
    subtitle:
      "A short, optional survey that helps us match you to employers who actually fit what matters to you.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — when it's a good time, we'd love to know what matters most to you in an employer: growth, balance, pay, purpose, the people. It helps us point you toward employers who fit.`,
    softNote:
      "This is completely optional and takes about three minutes. Your answers stay on your profile, and you can update them anytime — there's no rush and no wrong answer.",
    ctaLabel: "Share what you value",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Hi ${name},

When it's a good time: what matters most to you in an employer? A short, optional survey (about three minutes) helps us match you to employers who fit what you value. Your answers stay on your profile and you can update them anytime.

Share what you value: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Qu'est-ce qui compte pour toi chez un employeur ?",
    preheader: "Facultatif — nous aide à te matcher à des employeurs qui te correspondent.",
    kicker: "Quand tu seras prêt(e)",
    title: "Qu'est-ce qui compte pour toi au travail ?",
    subtitle:
      "Un court sondage facultatif qui nous aide à te matcher à des employeurs qui correspondent vraiment à ce qui compte pour toi.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — quand ce sera un bon moment, on aimerait savoir ce qui compte le plus pour toi chez un employeur : la croissance, l'équilibre, la rémunération, la mission, les gens. Ça nous aide à t'orienter vers des employeurs qui te conviennent.`,
    softNote:
      "C'est entièrement facultatif et ça prend environ trois minutes. Tes réponses restent sur ton profil, et tu peux les modifier quand tu veux — rien ne presse et il n'y a pas de mauvaise réponse.",
    ctaLabel: "Partager ce qui compte pour moi",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Salut ${name},

Quand ce sera un bon moment : qu'est-ce qui compte le plus pour toi chez un employeur ? Un court sondage facultatif (environ trois minutes) nous aide à te matcher à des employeurs qui correspondent à tes valeurs. Tes réponses restent sur ton profil et tu peux les modifier quand tu veux.

Partager ce qui compte pour moi : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingValuesEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "values",
    buildOnboardingContent(ONBOARDING_VALUES_CONTENT[locale], firstName, ctaUrl),
    locale
  );

/**
 * Step 6 · day 18 · anonymous self-identification survey (SENSITIVE, pillar 3).
 * Anonymity & voluntariness stated IN THE BODY before the click; why-first;
 * soft CTA; NO urgency / FOMO / countdown. At most once.
 */
const ONBOARDING_SELFID_CONTENT: Record<Locale, OnboardingStepCopy> = {
  en: {
    subject: "An optional, anonymous question — only if you're comfortable",
    preheader: "Anonymous, voluntary, never linked to you or shown to employers.",
    kicker: "Optional & anonymous",
    title: "Help us support students from every background.",
    subtitle:
      "A voluntary, anonymous survey that helps us understand who's entering the Canadian workforce — and support everyone better.",
    intro: (name) =>
      `Hi <strong>${name}</strong> — this one is completely optional. If you're comfortable, a few anonymous questions help us better support students from all backgrounds and share honest, aggregate insight about who's entering the Canadian workforce.`,
    softNote:
      "Your answers are <strong>anonymous</strong> and are <strong>never linked to your profile</strong>, never shown to employers, and never used to screen anyone. Every question has a \"Prefer not to say,\" and you can skip the whole thing. Because it's truly anonymous, a response can't be traced back to you later — that's exactly what keeps it private.",
    ctaLabel: "Share anonymously",
    footerLine: ONBOARDING_FOOTER.en,
    greetingName: "there",
    text: (name, ctaUrl) =>
      `Hi ${name},

This one is completely optional. If you're comfortable, a few anonymous questions help us support students from all backgrounds and share honest, aggregate insight about the Canadian workforce.

Your answers are anonymous, never linked to your profile, never shown to employers, and never used to screen anyone. Every question has a "Prefer not to say," and you can skip it entirely.

Share anonymously: ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  },
  fr: {
    subject: "Une question facultative et anonyme — seulement si tu es à l'aise",
    preheader: "Anonyme, volontaire, jamais liée à toi ni transmise aux employeurs.",
    kicker: "Facultatif et anonyme",
    title: "Aide-nous à soutenir les étudiants de tous les horizons.",
    subtitle:
      "Un sondage volontaire et anonyme qui nous aide à comprendre qui entre sur le marché du travail canadien — et à mieux soutenir tout le monde.",
    intro: (name) =>
      `Salut <strong>${name}</strong> — celui-ci est entièrement volontaire. Si tu es à l'aise, quelques questions anonymes nous aident à mieux soutenir les étudiants de tous les horizons et à partager un portrait honnête et global de qui entre sur le marché du travail canadien.`,
    softNote:
      "Tes réponses sont <strong>anonymes</strong> et ne sont <strong>jamais liées à ton profil</strong>, jamais transmises aux employeurs et jamais utilisées pour évaluer qui que ce soit. Chaque question a un « Je préfère ne pas répondre », et tu peux tout sauter. Comme c'est réellement anonyme, une réponse ne peut pas être retracée jusqu'à toi plus tard — c'est exactement ce qui la garde privée.",
    ctaLabel: "Partager anonymement",
    footerLine: ONBOARDING_FOOTER.fr,
    greetingName: "toi",
    text: (name, ctaUrl) =>
      `Salut ${name},

Celui-ci est entièrement volontaire. Si tu es à l'aise, quelques questions anonymes nous aident à soutenir les étudiants de tous les horizons et à partager un portrait honnête et global du marché du travail canadien.

Tes réponses sont anonymes, jamais liées à ton profil, jamais transmises aux employeurs et jamais utilisées pour évaluer qui que ce soit. Chaque question a un « Je préfère ne pas répondre », et tu peux tout sauter.

Partager anonymement : ${ctaUrl}

© ${new Date().getFullYear()} Tail'ed. Tous droits réservés.`,
  },
};

export const sendOnboardingSelfIdEmail = (
  email: string,
  firstName: string,
  ctaUrl: string,
  locale: Locale = "en"
): Promise<unknown> =>
  sendOnboardingEmail(
    email,
    "selfid",
    buildOnboardingContent(ONBOARDING_SELFID_CONTENT[locale], firstName, ctaUrl),
    locale
  );

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DIGEST_UTM = { source: "digest", medium: "email" } as const;

interface DigestCopy {
  subjectOne: (what: string) => string;
  subjectMany: (count: number, what: string) => string;
  subjectWhatWithQuery: (query: string) => string;
  subjectWhatDefault: string;
  typeNewGrad: string;
  typeInternship: string;
  kicker: string;
  headerTitle: (count: number) => string;
  headerSubtitle: (whatLine: string) => string;
  whatLine: (query: string | null | undefined) => string;
  whatLineText: (query: string | null | undefined) => string;
  scopeText: (shown: number, total: number) => string;
  preheader: (scopeText: string) => string;
  browseAll: string;
  darkTitle: string;
  darkBody: string;
  darkCta: string;
  seeRole: string;
  footerLine: (query: string | null | undefined) => string;
  textHeading: string;
  textIntro: (whatLineText: string) => string;
  moreLineText: (shown: number, total: number) => string;
  browseAllText: string;
  unsubscribeText: string;
  rightsText: string;
}

const DIGEST_CONTENT: Record<Locale, DigestCopy> = {
  en: {
    subjectOne: (what) => `1 new ${what} match for you`,
    subjectMany: (count, what) => `${count} new ${what} matches for you`,
    subjectWhatWithQuery: (query) => `"${query}"`,
    subjectWhatDefault: "job",
    typeNewGrad: "New grad",
    typeInternship: "Internship",
    kicker: "Daily Job Alert",
    headerTitle: (count) => `${count} new role${count === 1 ? "" : "s"} today`,
    headerSubtitle: (whatLine) =>
      `Here are the ${whatLine} we found since your last digest.`,
    whatLine: (query) =>
      query
        ? `new <strong style="color:#EB7A24;">${escapeHtml(query)}</strong> roles`
        : `new internships and new-grad roles`,
    whatLineText: (query) =>
      query ? `new "${query}" roles` : `new internships and new-grad roles`,
    scopeText: (shown, total) =>
      total > shown
        ? `Showing the newest ${shown} of ${total} matches today`
        : `${shown} new match${shown === 1 ? "" : "es"} today`,
    preheader: (scopeText) =>
      `${scopeText} — fresh roles for your Tail'ed Community alert.`,
    browseAll: "Browse all jobs",
    darkTitle: "Happening near you",
    darkBody:
      "Career fairs, hacknights and student communities on Tail'ed Community — meet people and get hired faster.",
    darkCta: "Explore events &amp; communities",
    seeRole: "See role &rarr;",
    footerLine: (query) =>
      `You subscribed to job alerts${
        query ? ` for &quot;${escapeHtml(query)}&quot;` : ""
      } on community.tailed.ca.`,
    textHeading: "Your daily job digest",
    textIntro: (whatLineText) =>
      `Here are the ${whatLineText} we found since your last digest.`,
    moreLineText: (shown, total) =>
      total > shown
        ? `\nShowing the newest ${shown} of ${total} matches today.\n`
        : "",
    browseAllText: "Browse all jobs",
    unsubscribeText: "Unsubscribe",
    rightsText: "All rights reserved.",
  },
  fr: {
    subjectOne: (what) => `1 nouveau match ${what} pour toi`,
    subjectMany: (count, what) => `${count} nouveaux matchs ${what} pour toi`,
    subjectWhatWithQuery: (query) => `« ${query} »`,
    subjectWhatDefault: "d'emploi",
    typeNewGrad: "Nouveau diplômé",
    typeInternship: "Stage",
    kicker: "Alerte d'emploi quotidienne",
    headerTitle: (count) =>
      `${count} nouveau${count === 1 ? "" : "x"} poste${
        count === 1 ? "" : "s"
      } aujourd'hui`,
    headerSubtitle: (whatLine) =>
      `Voici ${whatLine} qu'on a trouvés depuis ton dernier résumé.`,
    whatLine: (query) =>
      query
        ? `de nouveaux postes <strong style="color:#EB7A24;">${escapeHtml(
            query
          )}</strong>`
        : `de nouveaux stages et postes pour nouveaux diplômés`,
    whatLineText: (query) =>
      query
        ? `de nouveaux postes « ${query} »`
        : `de nouveaux stages et postes pour nouveaux diplômés`,
    scopeText: (shown, total) =>
      total > shown
        ? `Les ${shown} matchs les plus récents sur ${total} aujourd'hui`
        : `${shown} nouveau${shown === 1 ? "" : "x"} match${
            shown === 1 ? "" : "s"
          } aujourd'hui`,
    preheader: (scopeText) =>
      `${scopeText} — de nouveaux postes pour ton alerte Tail'ed Community.`,
    browseAll: "Parcourir tous les emplois",
    darkTitle: "Près de chez toi",
    darkBody:
      "Des salons de l'emploi, des hacknights et des communautés étudiantes sur Tail'ed Community — rencontre du monde et fais-toi embaucher plus vite.",
    darkCta: "Explorer les événements &amp; communautés",
    seeRole: "Voir le poste &rarr;",
    footerLine: (query) =>
      `Tu t'es abonné(e) aux alertes d'emploi${
        query ? ` pour &quot;${escapeHtml(query)}&quot;` : ""
      } sur community.tailed.ca.`,
    textHeading: "Ton résumé d'emplois quotidien",
    textIntro: (whatLineText) =>
      `Voici ${whatLineText} qu'on a trouvés depuis ton dernier résumé.`,
    moreLineText: (shown, total) =>
      total > shown
        ? `\nLes ${shown} matchs les plus récents sur ${total} aujourd'hui.\n`
        : "",
    browseAllText: "Parcourir tous les emplois",
    unsubscribeText: "Se désabonner",
    rightsText: "Tous droits réservés.",
  },
};

/**
 * Send the daily jobs digest email (WS5). `jobs` must already be capped
 * (12 max) and sorted newest-first by the caller — this function only
 * renders. Every job link carries `?utm_source=digest&utm_medium=email` so
 * digest -> click is measurable in analytics. `options.locale` defaults to
 * "en"; the caller resolves it from the subscriber's profile.
 */
export const sendJobsDigestEmail = async (
  email: string,
  jobs: DigestJob[],
  options: {
    query?: string | null;
    unsubscribeUrl: string;
    totalMatchCount: number;
    locale?: Locale;
  }
) => {
  const { query, unsubscribeUrl, totalMatchCount, locale = "en" } = options;
  const c = DIGEST_CONTENT[locale];

  const subjectWhat = query
    ? c.subjectWhatWithQuery(query)
    : c.subjectWhatDefault;
  const subject =
    jobs.length === 1
      ? c.subjectOne(subjectWhat)
      : c.subjectMany(jobs.length, subjectWhat);

  const typeLabel = (type: DigestJob["type"]) =>
    type === "new-grad" ? c.typeNewGrad : c.typeInternship;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `Jobs digest email sent to ${email} params: ${JSON.stringify({
        subject,
        jobCount: jobs.length,
        totalMatchCount,
        unsubscribeUrl,
        locale,
      })}`
    );
    return Promise.resolve();
  }

  const rowsHtml = jobs
    .map((job) => {
      const jobUrl = buildJobDetailUrl(job.id, DIGEST_UTM);
      return `
        <tr><td style="padding:0 0 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr><td style="padding:16px 20px;">
              <a href="${jobUrl}" style="font:700 16px/1.3 ${EMAIL_FONT};color:#2F1E02;text-decoration:none;">${escapeHtml(
                job.title
              )}</a>
              <div style="font:400 13px/1.5 ${EMAIL_FONT};color:#836E51;margin-top:3px;">${escapeHtml(
                job.companyName
              )}${job.location ? ` &middot; ${escapeHtml(job.location)}` : ""}</div>
              <div style="margin-top:10px;">
                <span style="display:inline-block;font:700 11px ${EMAIL_FONT};color:#B4661F;background:#FEF3E2;border-radius:999px;padding:3px 11px;">${typeLabel(
                  job.type
                )}</span>
                <span style="font:400 12px ${EMAIL_FONT};color:#A18B6D;margin-left:8px;">${escapeHtml(
                  job.datePostedLabel || ""
                )}</span>
                <a href="${jobUrl}" style="float:right;font:700 13px ${EMAIL_FONT};color:#EB7A24;text-decoration:none;">${c.seeRole}</a>
              </div>
            </td></tr>
          </table>
        </td></tr>`;
    })
    .join("");

  const rowsText = jobs
    .map((job) => {
      const jobUrl = buildJobDetailUrl(job.id, DIGEST_UTM);
      return `- ${job.title} — ${job.companyName}${job.location ? ` (${job.location})` : ""} [${typeLabel(job.type)}]\n  ${jobUrl}`;
    })
    .join("\n\n");

  const whatLine = c.whatLine(query);
  const scopeText = c.scopeText(jobs.length, totalMatchCount);
  const moreLineText = c.moreLineText(jobs.length, totalMatchCount);

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject,
    html: emailShell(
      c.preheader(scopeText),
      emailHeader(
        c.kicker,
        c.headerTitle(jobs.length),
        c.headerSubtitle(whatLine)
      ) +
        `
        <tr><td align="center" style="padding:20px 24px 0;">
          <div style="display:inline-block;background:#FEF3E2;border-radius:999px;padding:7px 16px;font:700 13px ${EMAIL_FONT};color:#B4661F;">${scopeText}</div>
        </td></tr>
        <tr><td style="padding:18px 24px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:10px 24px 28px;">${emailButton(
          `${EMAIL_SITE_URL}/jobs`,
          c.browseAll
        )}</td></tr>` +
        emailDarkPanel(
          c.darkTitle,
          c.darkBody,
          `${EMAIL_SITE_URL}/events`,
          c.darkCta
        ) +
        emailFooter(c.footerLine(query), unsubscribeUrl, locale)
    ),
    text: `${c.textHeading}\n\n${c.textIntro(
      c.whatLineText(query)
    )}\n\n${rowsText}\n${moreLineText}\n${c.browseAllText}: ${EMAIL_SITE_URL}/jobs\n\n${
      c.unsubscribeText
    }: ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Tail'ed. ${c.rightsText}`,
  };

  return transport.sendMail(mailOptions);
};

