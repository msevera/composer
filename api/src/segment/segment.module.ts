import { Module, Global } from '@nestjs/common';
import { SegmentService } from './segment.service';

@Global()
@Module({
  providers: [SegmentService],
  exports: [SegmentService],
})
export class SegmentModule {}

