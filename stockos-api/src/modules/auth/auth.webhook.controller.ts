import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { registrationProfileFromMetadata } from './utils/registration-profile.util';

interface SupabaseAuthUsersWebhookBody {
  type: string;
  table: string;
  schema: string;
  record: {
    id?: string;
    email?: string;
    raw_user_meta_data?: Record<string, unknown>;
  };
}

function isSupabaseAuthUsersInsert(
  body: unknown,
): body is SupabaseAuthUsersWebhookBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b['type'] === 'string' &&
    typeof b['table'] === 'string' &&
    typeof b['schema'] === 'string' &&
    typeof b['record'] === 'object' &&
    b['record'] !== null
  );
}

@ApiTags('Webhooks')
@Controller('webhooks/supabase')
export class SupabaseWebhookController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('on-signup')
  @ApiOperation({
    summary: 'Supabase Database Webhook — new row in auth.users (INSERT)',
  })
  async onSignup(
    @Body() body: unknown,
    @Headers('x-webhook-secret') secretHeader?: string,
  ): Promise<{ ok: boolean }> {
    const expected = this.configService.get<string>('app.supabase.webhookSecret');
    if (!expected || secretHeader !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (
      isSupabaseAuthUsersInsert(body) &&
      body.type === 'INSERT' &&
      body.schema === 'auth' &&
      body.table === 'users'
    ) {
      const id = body.record.id ?? '';
      const email = body.record.email ?? '';
      const meta = body.record.raw_user_meta_data ?? {};
      const profile = registrationProfileFromMetadata(
        meta as Record<string, unknown>,
        email,
      );
      if (id && email) {
        await this.authService.syncUserFromSupabase(id, email, profile);
      }
    }

    return { ok: true };
  }
}
