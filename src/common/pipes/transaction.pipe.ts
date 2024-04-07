import { BadRequestException, PipeTransform } from '@nestjs/common';
import { Transaction } from 'src/interfaces';

export class TransactionPipe implements PipeTransform {
  transform(value: string): Transaction {
    const splittedValue = value.split(' ');
    if (splittedValue.length !== 4) {
      throw new BadRequestException('bad size of args');
    }
    const transaction: Transaction = {
      createdAt: new Date(splittedValue[0]),
      assetSymbol: splittedValue[1].toUpperCase(),
      price: parseFloat(splittedValue[2]),
      amount: parseFloat(splittedValue[3]),
    };
    if (
      !(transaction.createdAt instanceof Date) ||
      isNaN(transaction.createdAt.getTime())
    ) {
      throw new BadRequestException('bad date');
    }
    if (isNaN(transaction.price)) {
      throw new BadRequestException('bad price');
    }
    if (isNaN(transaction.amount)) {
      throw new BadRequestException('bad amount');
    }
    return transaction;
  }
}
