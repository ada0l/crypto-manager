import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Knex } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import { lastValueFrom } from 'rxjs';
import { CoinInfo } from 'src/interfaces';

@Injectable()
export class UpdaterService implements OnModuleInit {
  private readonly logger = new Logger(UpdaterService.name);
  private readonly cryptoCompareUrl = 'https://min-api.cryptocompare.com';

  constructor(
    @InjectConnection() private readonly knex: Knex,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.updateCron();
  }

  async fetchCoinTopPage(limit: number, page: number): Promise<CoinInfo[]> {
    const response = await lastValueFrom(
      this.httpService.get(`/data/top/mktcapfull`, {
        params: { limit, page, tsym: 'USD' },
        headers: { authorization: process.env.CRYPTO_COMPARE_AUTH },
        baseURL: this.cryptoCompareUrl,
      }),
    );
    return response.data.Data.map((asset: any) => ({
      symbol: asset.CoinInfo.Name,
      price: asset.RAW?.USD.PRICE,
    })).filter((asset: CoinInfo) => asset.price);
  }

  async fetchCoinTop(
    coinLimit: number,
    coinPages: number,
  ): Promise<CoinInfo[]> {
    let result = [];
    for (let page = 0; page < coinPages; page++) {
      result = [...result, ...(await this.fetchCoinTopPage(coinLimit, page))];
    }
    return result;
  }

  async updateCoinTop(coins: CoinInfo[]) {
    if (!coins.length) return;
    await this.knex.transaction(async (tx) => {
      await tx
        .table('assets')
        .insert(coins.map((coin) => ({ symbol: coin.symbol })))
        .onConflict(tx.raw('(symbol)'))
        .ignore();

      const valuesQueries = coins.map((value) =>
        tx.raw(`(?::timestamp, ?::varchar, ?)`, [
          new Date().toISOString(),
          value.symbol,
          value.price,
        ]),
      );
      await tx.raw(`
        insert into prices(created_at, value, asset_id)
        select x.datetime, x.asset_price, a.id
        from (values ${valuesQueries.join(', ')}) x (datetime, asset_symbol, asset_price)
        join assets a on x.asset_symbol = a.symbol;
      `);
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateCron(): Promise<void> {
    this.logger.log('Start update');
    const [coinLimit, coinPages] = [
      process.env.COIN_LIMIT,
      process.env.COIN_PAGES,
    ].map(Number);
    try {
      const coins = await this.fetchCoinTop(coinLimit, coinPages);
      this.logger.log(`Got ${coins.length} coins`);
      this.updateCoinTop(coins);
    } catch (ex) {
      this.logger.error(`Failed to update coins: ${ex}`, ex?.stack);
    }
    this.logger.log('End update');
  }
}
