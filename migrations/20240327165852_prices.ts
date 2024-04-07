import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('prices', (table) => {
    table.increments('id');
    table.datetime('created_at', { useTz: true }).notNullable();
    table.double('value').notNullable();
    table.integer('asset_id').notNullable();
    table.foreign('asset_id').references('assets.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('prices');
}
