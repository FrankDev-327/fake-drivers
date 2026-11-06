import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };

@Injectable()
export class SesService {
  private readonly client: SESv2Client;
  private readonly sender: string;

  constructor(config: ConfigService) {
    // same code as real AWS SES; locally the endpoint points at Floci
    this.client = new SESv2Client({
      region: config.getOrThrow<string>('SES_REGION'),
      endpoint: config.getOrThrow<string>('SES_ENDPOINT'),
    });
    // must be a verified identity (floci/init/ready.d verifies it on boot), as on AWS
    this.sender = config.getOrThrow<string>('SES_SENDER');
  }

  async send(email: OutgoingEmail): Promise<string> {
    const result = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.sender,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: email.html, Charset: 'UTF-8' },
              Text: { Data: email.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
    return result.MessageId;
  }
}
