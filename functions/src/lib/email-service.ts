import { createTransport } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const server = process.env.EMAIL_SERVER;
// const from = process.env.EMAIL_FROM;

// if (process.env.NODE_ENV === "development") {
//   to = process.env.DEV_EMAIL ?? "";
// }

const transport = createTransport(server);

/**
 * Send verification email to user
 */
export const sendVerificationEmail = async (
  email: string,
  verificationLink: string,
) => {
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
  inviteLink: string,
) => {
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
  applicationLink: string,
) => {
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
  organizationName: string,
) => {
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
  htmlContent: string,
): Promise<void> {
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
