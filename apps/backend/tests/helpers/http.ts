import http from 'node:http';

import type { Express } from 'express';
import request from 'supertest';

/**
 * Shared listening-server harness for integration specs.
 *
 * `request(app)` boots and tears down a fresh listener per call; on Windows
 * this accumulates ephemeral sockets and intermittently stalls requests even
 * though the application under test is healthy. Binding ONE server for the
 * suite removes the churn: requests hit an already-accepting socket.
 */
export function setupTestServer(app: Express): () => ReturnType<typeof request> {
  let server: http.Server | undefined;

  beforeAll((done) => {
    server = app.listen(0, () => done());
  });

  afterAll((done) => {
    if (!server) {
      done();
      return;
    }
    const s = server;
    server = undefined;
    // supertest keep-alive sockets keep close() pending; drop them first.
    s.closeAllConnections();
    s.close(() => done());
  });

  return () => {
    if (!server) throw new Error('Test server not started');
    return request(server);
  };
}
