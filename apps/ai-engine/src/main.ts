import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * AI Engine entrypoint.
 *
 * This is NOT a public-facing API — it is a queue-driven worker with one
 * internal health endpoint. Traffic path:
 *   RabbitMQ (whatsapp.message.inbound) -> AutoResponder -> WhatsApp send.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('ai-engine');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, genReqId: () => crypto.randomUUID() }),
    { bufferLogs: true },
  );

  // Internal-only HTTP surface: health checks for k8s probes
  app.enableCors({ origin: false });

  await app.listen(process.env.PORT ?? 5000, '0.0.0.0');
  logger.log(`AI Engine listening on ${process.env.PORT ?? 5000} [${process.env.NODE_ENV}]`);
}

void bootstrap();
