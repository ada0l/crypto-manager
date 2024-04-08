import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { HttpModule } from '@nestjs/axios';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [HttpModule, UsersModule, TransactionsModule],
  providers: [BotService, BotUpdate],
})
export class BotModule {}
