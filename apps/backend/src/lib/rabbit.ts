import { EXCHANGES } from '@wco/shared';
import type { Channel, ChannelModel } from 'amqplib';
import * as amqp from 'amqplib';

import { logger } from './logger.js';

/**
 * RabbitMQ domain-event publisher.
 *
 * The backend is primarily an HTTP API; its only broker duty is publishing
 * domain events (outbox relay + direct emits) that the AI engine, campaign
 * sender and analytics pipeline subscribe to. Publishing is best-effort:
 * durable state lives in Postgres outbox, so a broker outage degrades
 * realtime features without corrupting anything.
 */

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connecting: Promise<void> | null = null;

async function ensureChannel(): Promise<Channel> {
  if (channel) return channel;
  connecting ??= (async (): Promise<void> => {
    connection = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGES.DOMAIN_EVENTS, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'topic', { durable: true });
    connection.on('error', () => {
      channel = null;
      connecting = null;
    });
    connection.on('close', () => {
      channel = null;
      connecting = null;
    });
  })();
  await connecting;
  const established = channel as Channel | null;
  if (!established) throw new Error('RabbitMQ channel unavailable after connect');
  return established;
}

export async function publishDomainEvent(routingKey: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const ch = await ensureChannel();
    ch.publish(
      EXCHANGES.DOMAIN_EVENTS,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json' },
    );
  } catch (err) {
    // Never crash request paths on broker issues — outbox relay is the backstop.
    logger.warn('rabbit.publish-failed', {
      routingKey,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function disconnectRabbit(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // already closed
  }
  channel = null;
  connection = null;
  connecting = null;
}
