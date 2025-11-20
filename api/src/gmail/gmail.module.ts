import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { CalendarService } from './calendar.service';

@Module({
  providers: [GmailService, CalendarService],
  exports: [GmailService, CalendarService],
})
export class GmailModule {}

