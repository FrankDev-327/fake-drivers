import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { ReceiptsService } from './receipts.service';

// the rider's past rides with their emailed receipts
@Controller('users/me/receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  getMyReceipts(@Req() req: Request) {
    return this.receiptsService.getMyReceipts(req.user.id);
  }
}
