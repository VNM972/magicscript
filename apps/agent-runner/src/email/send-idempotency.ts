export type SendReservationStatus =
  | 'STARTED'
  | 'SENDING'
  | 'SEND_UNKNOWN'
  | 'SUCCEEDED';

export interface SendReservation {
  beginSend(jobId: string, messageId: string): Promise<SendReservationStatus>;
}

export async function sendWithPersistentReservation<T>(input: {
  reservation: SendReservation;
  jobId: string;
  messageId: string;
  sendMail: () => Promise<T>;
}): Promise<T> {
  const status = await input.reservation.beginSend(input.jobId, input.messageId);

  if (status !== 'STARTED') {
    throw new Error(`Refusing SMTP resend: persistent send state is ${status}`);
  }

  return input.sendMail();
}
