import { invariant } from "./invariant";
import { ValueObject } from "./value-object";

export class Version extends ValueObject<number> {
  private constructor(value: number) {
    super(value);
  }

  static initial(): Version {
    return new Version(0);
  }

  static from(value: number): Version {
    invariant(value >= 0, "non negative integer");
    return new Version(value);
  }

  get value(): number {
    return this.props;
  }

  toNumber(): number {
    return this.props;
  }

  isInitial(): boolean {
    return this.value === 0;
  }

  next(): Version {
    return new Version(this.toNumber() + 1);
  }

  previous(): Version {
    invariant(this.toNumber() > 0, "Cannot go to previous version below zero");
    return new Version(this.toNumber() - 1);
  }

  compare(other: Version): -1 | 0 | 1 {
    if (this.toNumber() < other.toNumber()) return -1;
    if (this.toNumber() > other.toNumber()) return 1;
    return 0;
  }

  isNextOf(other: Version): boolean {
    return this.toNumber() === other.toNumber() + 1;
  }

  isPreviousOf(other: Version): boolean {
    return this.toNumber() + 1 === other.toNumber();
  }
}
