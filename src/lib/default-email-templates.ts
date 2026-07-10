import {
  EMAIL_TEMPLATE_TYPES,
  type EmailTemplateType,
} from "./enums";

// Default email templates for each communication type.
// Used for both auto-initialization and template reset functionality.
export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailTemplateType,
  { subject: string; bodyHtml: string }
> = {
  BOOKING_CONFIRMATION: {
    subject: "Your Appointment is Confirmed — {{clinicName}}",
    bodyHtml:
      "<p>Dear {{patientName}},</p><p>Your appointment has been confirmed.</p><p><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}<br/><strong>Service:</strong> {{serviceName}}</p><p>We look forward to seeing you!</p>",
  },
  CANCELLATION: {
    subject: "Appointment Cancelled — {{clinicName}}",
    bodyHtml:
      "<p>Dear {{patientName}},</p><p>Your appointment on {{date}} at {{time}} has been cancelled.</p><p>If you did not request this cancellation, please contact us immediately.</p>",
  },
  RESCHEDULE: {
    subject: "Appointment Rescheduled — {{clinicName}}",
    bodyHtml:
      "<p>Dear {{patientName}},</p><p>Your appointment has been rescheduled.</p><p><strong>New Date:</strong> {{date}}<br/><strong>New Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}</p>",
  },
  REMINDER: {
    subject: "Appointment Reminder — {{clinicName}}",
    bodyHtml:
      "<p>Dear {{patientName}},</p><p>This is a friendly reminder about your upcoming appointment.</p><p><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{time}}<br/><strong>Provider:</strong> {{providerName}}<br/><strong>Location:</strong> {{clinicName}}</p>",
  },
  INTAKE: {
    subject: "Complete Your Intake Form — {{clinicName}}",
    bodyHtml:
      '<p>Dear {{patientName}},</p><p>To prepare for your upcoming appointment, please complete the intake form using the link below.</p><p><a href="{{intakeLink}}">Complete Intake Form</a></p>',
  },
  REVIEW_REQUEST: {
    subject: "How Was Your Visit? — {{clinicName}}",
    bodyHtml:
      '<p>Dear {{patientName}},</p><p>Thank you for visiting {{clinicName}}. We would appreciate your feedback!</p><p><a href="{{reviewLink}}">Leave a Review</a></p>',
  },
  PAYMENT_REQUEST: {
    subject: "Payment Required — {{clinicName}}",
    bodyHtml:
      '<p>Dear {{patientName}},</p><p>A payment of <strong>${{amount}}</strong> is required for your appointment.</p><p><a href="{{paymentLink}}">Pay Now</a></p>',
  },
};

/**
 * Returns an array of template data objects suitable for Prisma `createMany`.
 * One template is created for every type defined in EMAIL_TEMPLATE_TYPES.
 */
export function getDefaultTemplateDataForClinic(clinicId: string) {
  return EMAIL_TEMPLATE_TYPES.map((type) => {
    const tpl = DEFAULT_EMAIL_TEMPLATES[type];
    return {
      clinicId,
      type,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      isActive: true,
    };
  });
}