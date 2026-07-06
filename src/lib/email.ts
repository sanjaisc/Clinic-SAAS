// =============================================================================
// Mock Email Service
// =============================================================================
// Simulates sending emails for demo/sandbox environments.
// Logs emails to console and returns a mock message ID.
// =============================================================================

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendStaffEmail(
  payload: EmailPayload
): Promise<{ success: boolean; messageId: string }> {
  // Log the email for demo purposes
  console.log(`[EMAIL_SENT] to=${payload.to} subject="${payload.subject}"`);
  // Generate a mock message ID
  const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return { success: true, messageId };
}