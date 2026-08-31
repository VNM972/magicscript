import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendWithPersistentReservation,
  type SendReservation,
  type SendReservationStatus,
} from './send-idempotency';

test('blocks a resend after SMTP accepted before success persistence', async () => {
  let state: SendReservationStatus | 'RUNNING' = 'RUNNING';
  let sendMailCalls = 0;
  const reservation: SendReservation = {
    async beginSend() {
      if (state === 'RUNNING') {
        state = 'SENDING';
        return 'STARTED';
      }

      return state;
    },
  };

  const accepted = await sendWithPersistentReservation({
    reservation,
    jobId: 'job-1',
    messageId: 'message-1',
    sendMail: async () => {
      sendMailCalls += 1;
      return { messageId: '<accepted@example.test>' };
    },
  });

  assert.equal(accepted.messageId, '<accepted@example.test>');
  assert.equal(state, 'SENDING');

  await assert.rejects(
    () =>
      sendWithPersistentReservation({
        reservation,
        jobId: 'job-1',
        messageId: 'message-1',
        sendMail: async () => {
          sendMailCalls += 1;
          return { messageId: '<duplicate@example.test>' };
        },
      }),
    /persistent send state is SENDING/,
  );

  assert.equal(sendMailCalls, 1);
});
