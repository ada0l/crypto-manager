import { UseFilters } from '@nestjs/common';
import {
  Action,
  Command,
  Ctx,
  Help,
  InjectBot,
  Message,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { TelegrafExceptionFilter } from 'src/common/filters/telegraf-expcetion.filter';
import { TransactionPipe } from 'src/common/pipes/transaction.pipe';
import { Transaction } from 'src/interfaces';
import { Format, Input, Markup, Telegraf } from 'telegraf';
import { Context } from '../interfaces/';
import {
  CallbackQuery,
  Update as UpdateType,
  Message as MessageType,
} from 'telegraf/typings/core/types/typegram';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { UsersService } from 'src/users/users.service';
import { TransactionsService } from 'src/transactions/transactions.service';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class BotUpdate {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly httpService: HttpService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  @Start()
  @Help()
  async onStartCommand(@Ctx() ctx: Context) {
    const user = await this.usersService.getById(ctx.from.id);
    if (!user) {
      this.usersService.create(ctx.from.id);
    }
    ctx.sendPhoto('https://telegra.ph/file/4b0f34af2d917cb0b9943.jpg', {
      caption: Format.fmt(
        'Hey, folks! I will help you to manage your profit from crypto assets.',
        '\n\n',
        'To add your transaction, you can use two approaches:',
        '\n\n',
        '1) send a message in the pattern: \n',
        Format.code('2024-12-03 BTC 73000 0.1'),
        '\n',
        '2) send csv file, where each row matches the pattern: \n',
        Format.code('2024-12-03,BTC,73000,0.1'),
        '\n\n',
        Format.link(
          'Click to get more information',
          'https://telegra.ph/Crypto-compare-bot-04-07',
        ),
      ),
    });
  }

  @Command('export')
  async onExportCommand(@Ctx() ctx: Context) {
    const transactions =
      await this.transactionsService.getAllTransactionsByUserId(ctx.from.id);
    if (transactions.length == 0) {
      return "You don't have transactions to export";
    }
    const content = transactions
      .map(
        (transaction) =>
          `${transaction.createdAt.toISOString()},${transaction.assetSymbol},${transaction.price},${transaction.amount}`,
      )
      .join('\n');
    ctx.sendDocument(Input.fromBuffer(Buffer.from(content), 'export.csv'));
  }

  @Command('general_info')
  async onGeneralInfoCommand(@Ctx() ctx: Context) {
    const assetsProfit = await this.transactionsService.getAssetsProfitByUserId(
      ctx.from.id,
    );
    if (!assetsProfit) {
      return "You don't have transactions to show information";
    }
    await ctx.reply(
      Format.fmt(
        Format.bold('Total spent'),
        ': ',
        assetsProfit.totalSpent.toFixed(2),
        ' USD \n',
        Format.bold('Total price'),
        ': ',
        assetsProfit.totalPrice.toFixed(2),
        ' USD \n',
        Format.bold('Profit'),
        ': ',
        assetsProfit.profitPercent.toFixed(2),
        '%',
      ),
    );
  }

  @Command('clear')
  async onClearCommand(@Ctx() ctx: Context) {
    await this.transactionsService.deleteAllByUserId(ctx.from.id);
    return 'Transactions is deleted';
  }

  @Action(/delete-transaction:(\d+)/)
  async onDeleteTransactionAction(
    @Ctx()
    ctx: Context & {
      update: UpdateType.CallbackQueryUpdate<CallbackQuery.DataQuery>;
    },
  ) {
    const transactionId = parseInt(
      ctx.update.callback_query.data.split(':').at(1),
    );
    const ownership = await this.transactionsService.checkOwnership(
      transactionId,
      ctx.from.id,
    );
    if (ownership) {
      await this.transactionsService.deleteById(transactionId);
    }
    ctx.deleteMessage(ctx.update.callback_query.message.message_id);
  }

  @On('document')
  async onDocument(
    @Ctx()
    ctx: Context & {
      update: UpdateType.MessageUpdate<MessageType.DocumentMessage>;
    },
  ) {
    const { file_id: fileId } = ctx.update.message.document;
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const content = await lastValueFrom(
      this.httpService.get(fileUrl.href),
    ).then<string>((response) => response.data);
    const transactions: Transaction[] = content
      .split('\n')
      .map((row) => row.split(',').join(' '))
      .map((row) => new TransactionPipe().transform(row))
      .map((transaction: Transaction) => ({
        ...transaction,
        userId: ctx.from.id,
      }));
    await this.transactionsService.createFew(transactions);
    return 'Transactions is created';
  }

  @On('text')
  async onText(
    @Ctx() ctx: Context,
    @Message('text', new TransactionPipe()) tx: Transaction,
  ) {
    tx.userId = ctx.from.id;
    const transactionId = await this.transactionsService.create(tx);
    await ctx.sendMessage(
      `Asset: ${tx.assetSymbol}\nPrice:${tx.price}\nAmount:${tx.amount}`,
      {
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback(
            'Delete transaction',
            `delete-transaction:${transactionId}`,
          ),
        ]).reply_markup,
      },
    );
    await ctx.deleteMessage(ctx.message.message_id);
  }
}
