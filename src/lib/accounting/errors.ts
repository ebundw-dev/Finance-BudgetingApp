export class AccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AccountingError {}
export class NotFoundError extends AccountingError {}
export class InsufficientCategoryBalanceError extends AccountingError {}
export class InsufficientUnallocatedCashError extends AccountingError {}
