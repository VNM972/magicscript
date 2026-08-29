import { loadAmenMailConfig } from './config';
import { verifyAmenImap, verifyAmenSmtp } from './amen';

const config = loadAmenMailConfig();

process.stdout.write('Checking Amen SMTP authentication...\n');
await verifyAmenSmtp(config);
process.stdout.write('SMTP OK\n');

process.stdout.write('Checking Amen IMAP authentication...\n');
await verifyAmenImap(config);
process.stdout.write('IMAP OK\n');

process.stdout.write('Amen mailbox connectivity is ready. No email was sent.\n');
