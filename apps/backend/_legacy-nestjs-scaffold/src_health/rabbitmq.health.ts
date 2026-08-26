import { HealthIndicator, HealthIndicatorResult, type HealthCheckError } from '@nestjs/terminus';
import * as amqp from 'amqplib';
import type { Connection } from 'amqplib';

/**
 * RabbitMQHealthIndicator — verifies the broker connection is open.
 */
export class RabbitMQHealthIndicator extends HealthIndicator {
  private static connection: Connection | null = null;
  private static connecting: Promise<Connection> | null = null;

  constructor(private readonly url: string | undefined) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      if (!this.url) return this.getStatus(key, false, { message: 'RABBITMQ_URL missing' });
      const connection = await RabbitMQHealthIndicator.ensureConnection(this.url);
      return this.getStatus(key, connection.connection.open);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      throw { [key]: { status: 'down', message } } satisfies HealthCheckError;
    }
  }

  /** Shared singleton so every health probe reuses one socket. */
  private static ensureConnection(url: string): Promise<Connection> {
    this.connecting ??= amqp
      .connect(url)
      .then((connection) => {
        this.connection = connection;
        connection.on('error', () => {
          this.connection = null;
          this.connecting = null;
        });
        return connection;
      })
      .catch((error: unknown) => {
        this.connecting = null;
        throw error;
      });
    return this.connecting as Promise<Connection>;
  }
}
