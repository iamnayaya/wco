import { Global, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import { RabbitMQService } from './rabbitmq.service';

/**
 * QueueModule — shared RabbitMQ access for producers and the outbox relay.
 * Registered once at the root; feature modules import RabbitMQService via DI.
 */
@Global()
@Module({
  providers: [
    {
      provide: RabbitMQService,
      useFactory: (config: ConfigService<Configuration>) =>
        new RabbitMQService(config.get('rabbitmq.url', '')),
      inject: [ConfigService],
    },
  ],
  exports: [RabbitMQService],
})
export class QueueModule implements OnApplicationBootstrap {
  constructor(private readonly rabbitmq: RabbitMQService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitmq.onModuleInit();
  }
}
