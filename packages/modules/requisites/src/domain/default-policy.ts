export function resolveCreateRequisiteDefaultFlag(input: {
  requestedIsDefault?: boolean;
  existingActiveCount: number;
}): boolean {
  return input.requestedIsDefault === true || input.existingActiveCount === 0;
}

export function shouldPromoteNextDefault(input: {
  wasDefault: boolean;
  nextIsDefault: boolean;
  currencyChanged: boolean;
}): boolean {
  return (
    input.wasDefault &&
    (input.nextIsDefault === false || input.currencyChanged === true)
  );
}
