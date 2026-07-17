import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import { buildJobDetailUrl } from "./links";
import type { DigestJob } from "./jobs-feed";

dotenv.config();

const server = process.env.EMAIL_SERVER;

const transport = createTransport(server);

/**
 * Send verification email to user
 */
export const sendVerificationEmail = async (
  email: string,
  verificationLink: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Email sent to ${email} params: ${JSON.stringify({ verificationLink })}`
    );
    return Promise.resolve();
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: "Verify your email address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Tail'ed!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p>
          <a 
            href="${verificationLink}" 
            style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;"
          >
            Verify Email
          </a>
        </p>
        <p>If you didn't create an account with us, you can ignore this email.</p>
        <p>The link will expire in 24 hours.</p>
      </div>
    `,
    text: `Welcome to Tail'ed! Please verify your email address by clicking this link: ${verificationLink}`,
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
 * Send welcome email when a new account is created via community import
 */
export const sendCommunityWelcomeEmail = async (
  email: string,
  firstName: string,
  communityName: string,
  eventTitle: string | null | undefined,
  loginLink: string
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

  // Dynamic message based on whether event is provided
  const welcomeMessage = eventTitle
    ? `Great news! You've been registered for <strong style="color: #EB7A24;">${eventTitle}</strong> through <strong style="color: #EB7A24;">${communityName}</strong> on Tail'ed Community.`
    : `Great news! You've been added to <strong style="color: #EB7A24;">${communityName}</strong> on Tail'ed Community.`;

  const welcomeMessageText = eventTitle
    ? `Great news! You've been registered for ${eventTitle} through ${communityName} on Tail'ed Community.`
    : `Great news! You've been added to ${communityName} on Tail'ed Community.`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: `Welcome to Tail'ed Community! 🎉`,
    html: `
      <div style="
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        max-width: 600px; 
        margin: 0 auto; 
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="
          background: linear-gradient(135deg, #EB7A24 0%, #FFD37D 100%);
          padding: 40px 20px;
          text-align: center;
        ">
          <h1 style="
            color: #ffffff;
            margin: 0;
            font-size: 32px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          ">Welcome to Tail'ed! 🎉</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <p style="
            color: #333333;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
          ">
            Hi ${firstName || 'there'},
          </p>

          <p style="
            color: #333333;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
          ">
            ${welcomeMessage}
          </p>

          <p style="
            color: #333333;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 30px 0;
          ">
            We've created an account for you to help you connect with opportunities, events, and fellow community members.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a 
              href="${loginLink}"
              style="
                display: inline-block;
                padding: 14px 32px;
                background: #EB7A24;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(235, 122, 36, 0.25);
              "
            >
              Access Your Account
            </a>
          </div>

          <!-- Features Box -->
          <div style="
            background-color: #FFF9F0;
            border-left: 4px solid #EB7A24;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
          ">
            <h3 style="
              color: #EB7A24;
              font-size: 18px;
              margin: 0 0 15px 0;
            ">What you can do with Tail'ed:</h3>
            <ul style="
              color: #555555;
              font-size: 15px;
              line-height: 1.8;
              margin: 0;
              padding-left: 20px;
            ">
              <li>Discover and register for upcoming events</li>
              <li>Connect with communities and organizations</li>
              <li>Explore job opportunities tailored for students</li>
              <li>Build your profile and showcase your skills</li>
            </ul>
          </div>

          <p style="
            color: #666666;
            font-size: 14px;
            line-height: 1.6;
            margin: 20px 0 0 0;
          ">
            Need help getting started? Visit our <a href="mailto:support@community.tailed.ca" style="color: #EB7A24; text-decoration: none;">support@community.tailed.ca</a> or reply to this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="
          background-color: #FFF9F0;
          padding: 25px 30px;
          text-align: center;
          border-top: 1px solid #FFD37D;
        ">
          <p style="
            color: #999999;
            font-size: 13px;
            margin: 0 0 10px 0;
          ">
            © ${new Date().getFullYear()} Tail'ed Community. All rights reserved.
          </p>
          <p style="
            color: #999999;
            font-size: 13px;
            margin: 0;
          ">
            Questions? Contact us at <a href="mailto:community@tailed.ca" style="color: #EB7A24; text-decoration: none;">community@tailed.ca</a>
          </p>
        </div>
      </div>
    `,
    text: `
Welcome to Tail'ed Community! 🎉

Hi ${firstName || 'there'},

${welcomeMessageText}

We've created an account for you to help you connect with opportunities, events, and fellow community members.

Access your account: ${loginLink}

What you can do with Tail'ed:
• Discover and register for upcoming events
• Connect with communities and organizations
• Explore job opportunities tailored for students
• Build your profile and showcase your skills

Need help getting started? Visit our help center at support@community.tailed.ca or reply to this email.

© ${new Date().getFullYear()} Tail'ed Community. All rights reserved.
Questions? Contact us at community@tailed.ca
    `,
  };
  return transport.sendMail(mailOptions);
};

/**
 * Send an approval email when an event organizer confirms a participation request.
 */
export const sendEventApprovalEmail = async (
  email: string,
  firstName: string,
  eventTitle: string,
  eventLink: string
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

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: `Your request to join ${eventTitle} has been approved`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #EB7A24 0%, #FFD37D 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 600;">You're approved</h1>
        </div>

        <div style="padding: 40px 30px;">
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi ${firstName || "there"},</p>
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Your request to join <strong style="color: #EB7A24;">${eventTitle}</strong> has been approved by the organizer.</p>
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">You can now access the event page and any future event-specific experiences from your Tail'ed dashboard.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${eventLink}" style="display: inline-block; padding: 14px 32px; background: #EB7A24; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(235, 122, 36, 0.25);">View Event</a>
          </div>
        </div>

        <div style="background-color: #FFF9F0; padding: 25px 30px; text-align: center; border-top: 1px solid #FFD37D;">
          <p style="color: #999999; font-size: 13px; margin: 0;">© ${new Date().getFullYear()} Tail'ed. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Hi ${firstName || "there"},\n\nYour request to join ${eventTitle} has been approved by the organizer.\n\nView the event: ${eventLink}\n\n© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  };

  return transport.sendMail(mailOptions);
};

/**
 * Send a welcome/confirmation email when a student subscribes to job alerts
 * (WS4 email capture). Confirms what they'll get and includes the
 * unsubscribe link — this is the only confirmation step for v1 (no
 * double opt-in; see docs/specs/04-email-capture.md "Out of scope").
 */
export const sendJobAlertWelcomeEmail = async (
  email: string,
  query: string | null | undefined,
  unsubscribeUrl: string
) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `Job alert welcome email sent to ${email} params: ${JSON.stringify({
        query,
        unsubscribeUrl,
      })}`
    );
    return Promise.resolve();
  }

  const whatLine = query
    ? `new <strong style="color: #EB7A24;">${escapeHtml(query)}</strong> roles`
    : `new internships and new-grad roles`;
  const whatLineText = query ? `new "${query}" roles` : `new internships and new-grad roles`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject: "You're in — daily job alerts from Tail'ed",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #EB7A24 0%, #FFD37D 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">You're in! 🎉</h1>
        </div>
        <div style="padding: 40px 30px;">
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            You'll now get ${whatLine} delivered to your inbox each morning — free, forever, no spam.
          </p>
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Your first digest lands as soon as there are fresh matches. No account required — just this inbox.
          </p>
        </div>
        <div style="background-color: #FFF9F0; padding: 25px 30px; text-align: center; border-top: 1px solid #FFD37D;">
          <p style="color: #999999; font-size: 12px; margin: 0 0 8px 0;">
            <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from these alerts</a>
          </p>
          <p style="color: #999999; font-size: 13px; margin: 0;">© ${new Date().getFullYear()} Tail'ed. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `You're in!\n\nYou'll now get ${whatLineText} delivered to your inbox each morning — free, forever, no spam.\n\nYour first digest lands as soon as there are fresh matches. No account required — just this inbox.\n\nUnsubscribe: ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  };

  return transport.sendMail(mailOptions);
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DIGEST_UTM = { source: "digest", medium: "email" } as const;

/**
 * Send the daily jobs digest email (WS5). `jobs` must already be capped
 * (12 max) and sorted newest-first by the caller — this function only
 * renders. Every job link carries `?utm_source=digest&utm_medium=email` so
 * digest -> click is measurable in analytics.
 */
export const sendJobsDigestEmail = async (
  email: string,
  jobs: DigestJob[],
  options: {
    query?: string | null;
    unsubscribeUrl: string;
    totalMatchCount: number;
  }
) => {
  const { query, unsubscribeUrl, totalMatchCount } = options;

  const subjectWhat = query ? `"${query}" jobs` : "jobs";
  const subject =
    jobs.length === 1
      ? `1 new ${subjectWhat} match for you`
      : `${jobs.length} new ${subjectWhat} matches for you`;

  const typeLabel = (type: DigestJob["type"]) =>
    type === "new-grad" ? "New grad" : "Internship";

  if (process.env.NODE_ENV === "development") {
    console.log(
      `Jobs digest email sent to ${email} params: ${JSON.stringify({
        subject,
        jobCount: jobs.length,
        totalMatchCount,
        unsubscribeUrl,
      })}`
    );
    return Promise.resolve();
  }

  const rowsHtml = jobs
    .map((job) => {
      const jobUrl = buildJobDetailUrl(job.id, DIGEST_UTM);
      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #f0e6d8;">
            <a href="${jobUrl}" style="color: #EB7A24; text-decoration: none; font-weight: 600; font-size: 16px;">
              ${escapeHtml(job.title)}
            </a>
            <div style="color: #444444; font-size: 14px; margin-top: 4px;">
              ${escapeHtml(job.companyName)}${job.location ? ` &middot; ${escapeHtml(job.location)}` : ""}
            </div>
            <div style="margin-top: 8px;">
              <span style="display: inline-block; background: #FFF9F0; color: #EB7A24; border: 1px solid #FFD37D; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-right: 6px;">
                ${typeLabel(job.type)}
              </span>
              <span style="color: #999999; font-size: 12px;">${escapeHtml(job.datePostedLabel || "")}</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const rowsText = jobs
    .map((job) => {
      const jobUrl = buildJobDetailUrl(job.id, DIGEST_UTM);
      return `- ${job.title} — ${job.companyName}${job.location ? ` (${job.location})` : ""} [${typeLabel(job.type)}]\n  ${jobUrl}`;
    })
    .join("\n\n");

  const whatLine = query
    ? `new <strong style="color: #EB7A24;">${escapeHtml(query)}</strong> roles`
    : `new internships and new-grad roles`;

  const moreLine =
    totalMatchCount > jobs.length
      ? `<p style="color: #666666; font-size: 13px; margin: 20px 0 0 0;">Showing the newest ${jobs.length} of ${totalMatchCount} matches today.</p>`
      : "";
  const moreLineText =
    totalMatchCount > jobs.length
      ? `\nShowing the newest ${jobs.length} of ${totalMatchCount} matches today.\n`
      : "";

  const mailOptions = {
    from: process.env.EMAIL_FROM || "Tail'ed <no-reply@tailed.ca>",
    sender: "no-reply@tailed.ca",
    to: email,
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #EB7A24 0%, #FFD37D 100%); padding: 32px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Your daily job digest</h1>
        </div>
        <div style="padding: 32px 30px;">
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Here are the ${whatLine} we found since your last digest.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            ${rowsHtml}
          </table>
          ${moreLine}
        </div>
        <div style="background-color: #FFF9F0; padding: 25px 30px; text-align: center; border-top: 1px solid #FFD37D;">
          <p style="color: #777777; font-size: 12px; margin: 0 0 10px 0;">
            Tail'ed is free, forever — a non-profit helping students find real opportunities, no spam, no data resale.
          </p>
          <p style="color: #999999; font-size: 12px; margin: 0 0 8px 0;">
            <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from these alerts</a>
          </p>
          <p style="color: #999999; font-size: 13px; margin: 0;">© ${new Date().getFullYear()} Tail'ed. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Your daily job digest\n\nHere are the ${query ? `new "${query}" roles` : "new internships and new-grad roles"} we found since your last digest.\n\n${rowsText}\n${moreLineText}\nTail'ed is free, forever — a non-profit helping students find real opportunities, no spam, no data resale.\n\nUnsubscribe: ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Tail'ed. All rights reserved.`,
  };

  return transport.sendMail(mailOptions);
};

