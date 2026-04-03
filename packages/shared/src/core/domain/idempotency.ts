import { invariant } from "./invariant";
import { ValueObject } from "./value-object";

export class IdempotencyId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static from(value: string): IdempotencyId {
    invariant(value, "non empty string");
    return new IdempotencyId(value.trim());
  }

  static generate(
    random: () => string = () => crypto.randomUUID(),
  ): IdempotencyId {
    const value = random();
    invariant(value, "non empty string");
    return new IdempotencyId(value);
  }

  get value(): string {
    return this.value;
  }
}
