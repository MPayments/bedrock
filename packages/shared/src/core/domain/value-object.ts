import { stableStringify } from "../canon";

export abstract class ValueObject<T> {
  protected readonly props: Readonly<T>;

  protected constructor(props: T) {
    this.props = props;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof ValueObject &&
      other.constructor === this.constructor &&
      stableStringify(other.props) === stableStringify(this.props)
    );
  }
}
