import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Env } from '../../config/env.validation';

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash giả để so sánh khi email không tồn tại: thời gian phản hồi như nhau, không lộ email nào đã đăng ký. */
  private dummyHash!: string;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(16).toString('hex'));
  }

  hash(password: string): Promise<string> {
    return hash(
      password,
      this.config.get('BCRYPT_SALT_ROUNDS', { infer: true }),
    );
  }

  async verify(passwordHash: string | undefined, password: string) {
    try {
      return await compare(password, passwordHash ?? this.dummyHash);
    } catch {
      return false;
    }
  }
}
