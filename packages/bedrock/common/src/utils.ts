export function assert(
  condition: unknown,
  error: Error | (() => Error),
): asserts condition {
  if (condition) {
    return;
  }

  throw typeof error === "function" ? error() : error;
}

export function findDirectedCycle<T>(
  nodes: readonly T[],
  getId: (node: T) => string,
  getEdges: (node: T) => readonly T[],
): string[] | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  const visit = (node: T): string[] | null => {
    const id = getId(node);

    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      return [...stack.slice(cycleStart), id];
    }

    if (visited.has(id)) {
      return null;
    }

    visiting.add(id);
    stack.push(id);

    for (const edge of getEdges(node)) {
      const cycle = visit(edge);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(id);
    visited.add(id);

    return null;
  };

  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function topologicalSort<T>(
  nodes: readonly T[],
  getId: (node: T) => string,
  getEdges: (node: T) => readonly T[],
): T[] {
  const visited = new Set<string>();
  const order: T[] = [];

  const visit = (node: T): void => {
    const id = getId(node);
    if (visited.has(id)) {
      return;
    }

    visited.add(id);

    for (const edge of getEdges(node)) {
      visit(edge);
    }

    order.push(node);
  };

  for (const node of nodes) {
    visit(node);
  }

  return order;
}
