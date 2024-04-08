import { Module } from '@nestjs/common';
import { UpdaterModule } from './updater/updater.module';
import { KnexModule } from 'nest-knexjs';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import { TelegrafModule } from 'nestjs-telegraf';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    KnexModule.forRootAsync({
      useFactory: () => ({
        config: {
          client: 'pg',
          version: process.env.DB_VERSION,
          useNullAsDefault: true,
          connection: {
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            port: process.env.DB_PORT,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
          },
        },
      }),
    }),
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_TOKEN,
      include: [BotModule],
    }),
    ScheduleModule.forRoot(),
    UpdaterModule,
    BotModule,
    UsersModule,
    TransactionsModule,
  ],
})
export class AppModule {}
