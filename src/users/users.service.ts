import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nest-knexjs';
import { User } from 'src/interfaces';

@Injectable()
export class UsersService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  public async getById(id: number): Promise<User> {
    const user = await this.knex
      .select()
      .from('public.users')
      .where('id', id)
      .first()
      .then<User>((row) => row);
    return user;
  }

  public async create(id: number): Promise<void> {
    await this.knex.insert({ id }).into('users');
  }
}
