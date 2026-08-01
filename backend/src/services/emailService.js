import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function otpTemplate({ heading, message, otp }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">${heading}</h2>
      <p>${message}</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">
        ${otp}
      </div>
      <p style="color: #64748b; font-size: 14px;">This OTP will expire in 10 minutes.</p>
      <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
}

export async function sendOTPEmail(email, otp) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">Verify Your Email</h2>
      <p>Thank you for signing up for the Recruitment Portal. Please use the OTP below to verify your email address:</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">
        ${otp}
      </div>
      <p style="color: #64748b; font-size: 14px;">This OTP will expire in 10 minutes.</p>
      <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.MAIL_FROM,
    to: email,
    subject: "Email Verification OTP - Recruitment Portal",
    html,
  });
}

export async function sendAdminOTPEmail(email, otp) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.MAIL_FROM,
    to: email,
    subject: "Admin Login OTP - Recruitment Portal",
    html: otpTemplate({
      heading: "Admin Login OTP",
      message:
        "Use the OTP below to complete the admin sign-in for the Recruitment Portal.",
      otp,
    }),
  });
}

export async function sendPasswordResetEmail(email, resetToken) {
  const clientOrigin = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
  const resetUrl = `${clientOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.MAIL_FROM,
    to: email,
    subject: "Password Reset - Recruitment Portal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>Use the secure link below to reset your Recruitment Portal password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset password</a></p>
        <p style="color:#64748b;font-size:14px;">This link will expire in 30 minutes.</p>
        <p style="color:#64748b;font-size:14px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}
