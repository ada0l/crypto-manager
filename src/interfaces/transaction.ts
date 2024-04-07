export interface Transaction {
  createdAt: Date;
  assetSymbol: string;
  price: number;
  amount: number;
  userId?: number;
}
