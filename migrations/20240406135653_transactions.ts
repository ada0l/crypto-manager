import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('transactions', (table) => {
    table.increments('id');
    table.datetime('created_at', { useTz: true }).notNullable();
    table.double('price').notNullable();
    table.double('amount').notNullable();
    table.integer('asset_id').notNullable();
    table.integer('user_id').notNullable();
    table.foreign('asset_id').references('assets.id');
    table.foreign('user_id').references('users.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('transactions');
}
