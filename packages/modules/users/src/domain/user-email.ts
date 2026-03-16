import { ValueObject, invariant } from "@bedrock/shared/core/domain";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UserEmail extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(value: unknown): UserEmail {
    invariant(
      typeof value === "string",
      "user.email.invalid",
      "invalid email",
      { field: "email", value },
    );

    const normalized = value.trim().toLowerCase();
    invariant(
      SIMPLE_EMAIL_PATTERN.test(normalized),
      "user.email.invalid",
      "invalid email",
      { field: "email", value },
    );
    return new UserEmail(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
