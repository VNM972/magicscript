export interface OutboundEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export interface SendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface EmailProvider {
  send(message: OutboundEmail): Promise<SendResult>;
}

export class DisabledEmailProvider implements EmailProvider {
  async send(_message: OutboundEmail): Promise<SendResult> {
    throw new Error('Email sending is disabled');
  }
}
