export class PaymentsError extends Error {
    name = "PaymentsError";
  }
  
  export class InvalidStateError extends PaymentsError {
    name = "InvalidStateError";
  }
  