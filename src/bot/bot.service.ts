import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import { GeneralInfo, Transaction, User } from 'src/interfaces';

@Injectable()
export class BotService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  public async getUser(id: number): Promise<User> {
    const user = await this.knex
      .select()
      .from('public.users')
      .where('id', id)
      .first()
      .then<User>((row) => row);
    return user;
  }

  public async createUser(id: number): Promise<void> {
    await this.knex.insert({ id }).into('users');
  }

  public async deleteAllTransactionsByUserId(userId: number): Promise<void> {
    await this.knex
      .delete()
      .from('transactions')
      .where('transactions.user_id', userId);
  }

  public async checkTransactionOwnership(
    transactionId: number,
    userId: number,
  ): Promise<boolean> {
    const transaction = await this.knex
      .select()
      .from('transactions')
      .where('id', transactionId)
      .andWhere('user_id', userId)
      .first();

    return transaction != null;
  }

  public async deleteTransaction(transactionId: number): Promise<void> {
    await this.knex.delete().from('transactions').where('id', transactionId);
  }

  public async createTransaction(transaction: Transaction): Promise<number> {
    return await this.createTransactions([transaction]).then((data) =>
      data.at(0),
    );
  }

  public async createTransactions(
    transactions: Transaction[],
  ): Promise<number[]> {
    let result: number[];
    await this.knex.transaction(async (tx) => {
      await tx
        .table('assets')
        .insert(
          transactions.map((transaction) => ({
            symbol: transaction.assetSymbol,
          })),
        )
        .onConflict(tx.raw('(symbol)'))
        .ignore();
      const valuesQueries = transactions.map((transaction) =>
        tx.raw(`(?::timestamp, ?, ?, ?::varchar, ?)`, [
          transaction.createdAt,
          transaction.price,
          transaction.amount,
          transaction.assetSymbol,
          transaction.userId,
        ]),
      );
      result = await tx
        .raw(
          `
        insert into transactions (created_at, price, amount, asset_id, user_id)
        select x.created_at, x.price, x.amount, a.id, x.user_id
        from (values ${valuesQueries.join(',')}) x (created_at, price, amount, asset_symbol, user_id)
        join assets a on x.asset_symbol = a.symbol
        returning id;
      `,
        )
        .then((result) => result.rows.map((row: { id: number }) => row.id));
    });
    return result;
  }

  private getAssetWithPriceQuery(
    qb: Knex.QueryBuilder<any, any>,
  ): Promise<any> {
    return qb
      .select([
        this.knex.raw('assets.id as id'),
        'assets.symbol',
        this.knex.raw(
          'last_value(prices.value) over (partition by assets.symbol order by prices.created_at desc) last_price',
        ),
      ])
      .distinctOn('id')
      .from('prices')
      .leftJoin('assets', 'assets.id', 'prices.asset_id');
  }

  private getUserTransactionsQuery(
    qb: Knex.QueryBuilder<any, any>,
    userId: number,
  ): Promise<any> {
    return qb
      .select([
        'transactions.asset_id',
        this.knex.raw('sum(transactions.amount) as sum_amount'),
        this.knex.raw('sum(transactions.amount * transactions.price) as spent'),
        this.knex.raw(
          'sum(transactions.amount * transactions.price * transactions.price) / sum(transactions.amount * transactions.price) as avg_price',
        ),
      ])
      .from('transactions')
      .where('transactions.user_id', userId)
      .groupBy('transactions.asset_id');
  }

  public async getAssetsInfoByUserId(userId: number): Promise<any> {
    return await this.knex('user_transactions')
      .with('assets_with_price', (qb) => this.getAssetWithPriceQuery(qb))
      .with('user_transactions', (qb) =>
        this.getUserTransactionsQuery(qb, userId),
      )
      .select(
        'assets_with_price.symbol',
        'user_transactions.*',
        this.knex.raw(
          'user_transactions.sum_amount * assets_with_price.last_price as total_price',
        ),
      )
      .leftJoin(
        'assets_with_price',
        'assets_with_price.id',
        'user_transactions.asset_id',
      )
      .orderBy('total_price', 'DESC');
  }

  public async getAllTransactionsByUserId(
    userId: number,
  ): Promise<Transaction[]> {
    return await this.knex
      .select('transactions.*', 'assets.symbol')
      .from('transactions')
      .where('user_id', userId)
      .orderBy('created_at', 'ASC')
      .leftJoin('assets', 'assets.id', 'transactions.asset_id')
      .then((transations) => {
        return transations.map((transaction) => ({
          createdAt: transaction.created_at,
          assetSymbol: transaction.symbol,
          price: transaction.price,
          amount: transaction.amount,
          userId: transaction.user_id,
        }));
      });
  }

  public async getAssetsProfitByUserId(
    userId: number,
  ): Promise<GeneralInfo | null> {
    const raw = (await this.knex('user_transactions')
      .with('assets_with_price', (qb) => this.getAssetWithPriceQuery(qb))
      .with('user_transactions', (qb) =>
        this.getUserTransactionsQuery(qb, userId),
      )
      .select(
        this.knex.raw('sum(user_transactions.spent) as total_spent'),
        this.knex.raw(
          'sum(user_transactions.sum_amount * assets_with_price.last_price) as total_price',
        ),
        this.knex.raw(
          'sum(user_transactions.sum_amount * assets_with_price.last_price) / sum(user_transactions.spent) * 100 as profit',
        ),
      )
      .leftJoin(
        'assets_with_price',
        'assets_with_price.id',
        'user_transactions.asset_id',
      )
      .first()) as any;
    if (raw?.total_price == null) {
      return null;
    }
    return {
      totalPrice: raw?.total_price,
      totalSpent: raw?.total_spent,
      profitPercent: raw?.profit,
    };
  }
}
