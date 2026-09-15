import type { Params } from 'nestjs-pino';

// Structured logging (spec section 33). Redaction paths cover every place a
// password/token could end up in a logged request/response: the login and
// refresh bodies, the Authorization header, and any Set-Cookie in the future.
// Redacted values are replaced, never just omitted, so the shape of what was
// logged still tells you a credential *was* present without leaking it.
export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true },
          },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.refreshToken',
        'req.body.accessToken',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    customProps: (req) => ({
      // Correlates every log line for a request without depending on a
      // separate request-id middleware (spec section 33: "cada request debe
      // poder relacionarse con traceId/userId/requestId").
      requestId: req.id,
    }),
  },
};
