module.exports = {
  verificationTemplate: (data) => `<h1>Verify Email</h1><p>Hi ${data.name}, token: ${data.verificationToken}</p>`,
  passwordResetTemplate: (data) => `<h1>Reset Password</h1><p>Hi ${data.name}, token: ${data.resetToken}</p>`,
  bookingConfirmationTemplate: (data) => `<h1>Booking Confirmed</h1><p>Hi ${data.name}, your booking is confirmed.</p>`,
  bookingCancellationTemplate: (data) => `<h1>Booking Cancelled</h1><p>Hi ${data.name}, your booking is cancelled.</p>`,
  paymentSuccessTemplate: (data) => `<h1>Payment Successful</h1><p>Hi ${data.name}, payment succeeded.</p>`,
  paymentFailureTemplate: (data) => `<h1>Payment Failed</h1><p>Hi ${data.name}, payment failed.</p>`,
  eventReminderTemplate: (data) => `<h1>Event Reminder</h1><p>Hi ${data.name}, your event is starting soon.</p>`
};
