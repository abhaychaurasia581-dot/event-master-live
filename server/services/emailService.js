const nodemailer = require('nodemailer');
const { Worker } = require('bullmq');
const env = require('../config/env');
const { emailQueue } = require('../config/queue');
const { getRedisClient } = require('../config/redis');
const { info, error: logError } = require('../utils/logger');
const emailTemplates = require('../templates/emailTemplates'); // Assuming this exists or will be created

// ---------------------------------------------------------
// SMTP Transporter Configuration
// ---------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort || 587,
  secure: env.smtpPort == 465, // true for 465, false for other ports
  auth: {
    user: env.smtpUser,
    pass: env.smtpPassword
  }
});

const defaultFrom = `"${env.smtpFromName || 'Eventify'}" <${env.smtpFromEmail || 'noreply@eventify.com'}>`;

/**
 * Core function to actually send the email via Nodemailer.
 * Used internally by the BullMQ worker.
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const infoMsg = await transporter.sendMail({
      from: defaultFrom,
      to,
      subject,
      html
    });
    info(`Email successfully sent to ${to} [Message ID: ${infoMsg.messageId}]`);
    return infoMsg;
  } catch (err) {
    logError(`Failed to send email to ${to}. Error: ${err.message}`);
    // Throw error so BullMQ knows the job failed and can apply retry strategies
    throw err;
  }
};

// ---------------------------------------------------------
// BullMQ Worker for processing email jobs asynchronously
// ---------------------------------------------------------
const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    const { type, payload } = job.data;
    const { email } = payload;
    let subject, html;

    switch (type) {
      case 'VERIFICATION':
        subject = 'Verify Your Email Address';
        html = emailTemplates.verificationTemplate(payload);
        break;
      case 'PASSWORD_RESET':
        subject = 'Reset Your Password';
        html = emailTemplates.passwordResetTemplate(payload);
        break;
      case 'BOOKING_CONFIRMATION':
        subject = 'Booking Confirmed - Eventify';
        html = emailTemplates.bookingConfirmationTemplate(payload);
        break;
      case 'BOOKING_CANCELLATION':
        subject = 'Booking Cancelled';
        html = emailTemplates.bookingCancellationTemplate(payload);
        break;
      case 'PAYMENT_SUCCESS':
        subject = 'Payment Successful';
        html = emailTemplates.paymentSuccessTemplate(payload);
        break;
      case 'PAYMENT_FAILURE':
        subject = 'Action Required: Payment Failed';
        html = emailTemplates.paymentFailureTemplate(payload);
        break;
      case 'EVENT_REMINDER':
        subject = 'Reminder: Upcoming Event';
        html = emailTemplates.eventReminderTemplate(payload);
        break;
      default:
        throw new Error(`Unknown email job type: ${type}`);
    }

    await sendEmail({ to: email, subject, html });
  },
  { connection: getRedisClient() }
);

emailWorker.on('completed', (job) => {
  info(`Email job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  logError(`Email job ${job.id} failed: ${err.message}`);
});

// ---------------------------------------------------------
// Public API Methods for Controllers to Enqueue Jobs
// ---------------------------------------------------------

/**
 * Enqueue an email job
 */
const enqueueEmail = async (type, payload) => {
  await emailQueue.add('processEmail', { type, payload });
};

const sendVerificationEmail = async (email, name, verificationToken) => {
  await enqueueEmail('VERIFICATION', { email, name, verificationToken });
};

const sendPasswordResetEmail = async (email, name, resetToken) => {
  await enqueueEmail('PASSWORD_RESET', { email, name, resetToken });
};

const sendBookingConfirmationEmail = async (email, name, bookingDetails) => {
  await enqueueEmail('BOOKING_CONFIRMATION', { email, name, bookingDetails });
};

const sendBookingCancellationEmail = async (email, name, bookingDetails) => {
  await enqueueEmail('BOOKING_CANCELLATION', { email, name, bookingDetails });
};

const sendPaymentSuccessEmail = async (email, name, paymentDetails) => {
  await enqueueEmail('PAYMENT_SUCCESS', { email, name, paymentDetails });
};

const sendPaymentFailureEmail = async (email, name, paymentDetails) => {
  await enqueueEmail('PAYMENT_FAILURE', { email, name, paymentDetails });
};

const sendEventReminderEmail = async (email, name, eventDetails) => {
  await enqueueEmail('EVENT_REMINDER', { email, name, eventDetails });
};

module.exports = {
  sendEmail, // Exposed for raw usage if needed, though enqueueing is preferred
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendEventReminderEmail
};
