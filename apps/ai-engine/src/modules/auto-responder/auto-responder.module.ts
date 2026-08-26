import { Module } from '@nestjs/common';
import { AutoResponderService } from './auto-responder.service';

@Module({
  providers: [AutoResponderService],
  exports: [AutoResponderService],
})
export class AutoResponderModule {}
