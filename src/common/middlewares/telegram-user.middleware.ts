import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const iniData = req.headers['telegram-data'];
    const user = checkAuthorization(iniData);

    if (user) {
      req['user'] = { id: user };
      next();
    } else {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.write('unauthorized');
      res.end();
    }
  }
}

function parseAuthString(initData) {
  const searchParams = new URLSearchParams(initData);

  const hash = searchParams.get('hash');
  searchParams.delete('hash');

  const restKeys = Array.from(searchParams.entries());
  restKeys.sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey));

  const dataCheckString = restKeys.map(([n, v]) => `${n}=${v}`).join('\n');

  return {
    dataCheckString,
    hash,
    metaData: {
      user: JSON.parse(searchParams.get('user')),
      auth_date: searchParams.get('auth_date'),
      query_id: searchParams.get('query_id'),
    },
  };
}

function encodeHmac(message, key, repr = undefined) {
  return crypto.createHmac('sha256', key).update(message).digest(repr);
}

function checkAuthorization(iniData) {
  const authTelegramData = parseAuthString(iniData);

  const secretKey = encodeHmac(
    process.env.TELEGRAM_TOKEN,
    process.env.TELEGRAM_WEB_APP_DATA,
  );

  const validationKey = encodeHmac(
    authTelegramData.dataCheckString,
    secretKey,
    'hex',
  );

  if (validationKey === authTelegramData.hash) {
    return authTelegramData.metaData.user;
  }

  return null;
}
