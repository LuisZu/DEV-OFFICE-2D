import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Rate limiting is a production/dev concern, not a test concern: e2e suites
// legitimately log in dozens of times per file (one call per seeded role,
// per test). Skipping in NODE_ENV=test avoids weakening the real limits just
// to accommodate tests.
@Injectable()
export class ConditionalThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
