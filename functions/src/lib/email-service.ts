import { createTransport } from "nodemailer";
import dotenv from "dotenv";

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

