import { loadAmenMailConfig } from './config';
import { sendAmenEmail } from './amen';

const recipient = process.env.MAGICSCRIPT_TEST_RECIPIENT?.trim().toLowerCase();

if (!recipient) {
  throw new Error('MAGICSCRIPT_TEST_RECIPIENT is required');
}

if (process.env.MAGICSCRIPT_TEST_EMAIL_MODE !== 'true') {
  throw new Error(
    'Refusing test send because MAGICSCRIPT_TEST_EMAIL_MODE is not true',
  );
}

const result = await sendAmenEmail(loadAmenMailConfig(), {
  to: recipient,
  subject: 'Magic Script V2 — SMTP test',
  text: [
    'Magic Script V2 controlled SMTP test.',
    '',
    'This message was intentionally sent only to the configured test inbox.',
    'No prospect was contacted.',
    '',
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n'),
});

process.stdout.write(
  JSON.stringify(
    {
      ok: result.accepted.length > 0,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      testRecipient: recipient,
    },
    null,
    2,
  ) + '\n',
);

if (!result.accepted.length) {
  process.exitCode = 1;
}
