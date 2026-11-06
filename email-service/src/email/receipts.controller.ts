import { Controller, Get } from '@nestjs/common';
import { EmailService } from './email.service';
import { CurrentUserId } from '../common/current-user-id.decorator';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly emailService: EmailService) {}

  @Get('me')
  getMyReceipts(@CurrentUserId() userId: string) {
    return this.emailService.getMyReceipts(userId);
  }
}
