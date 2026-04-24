import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedCallback } from "@/features/treasury/steps/lib/use-debounced-callback";

describe("createDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the callback once after the delay", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced("a");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("a");
  });

  it("coalesces rapid consecutive calls into the last args", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);

    debounced("first");
    vi.advanceTimersByTime(50);
    debounced("second");
    vi.advanceTimersByTime(50);
    debounced("third");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });

  it("cancel() drops pending invocations", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(500);

    expect(callback).not.toHaveBeenCalled();
  });

  it("flush() fires immediately with the pending args", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced("pending");
    debounced.flush();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("pending");
  });

  it("flush() is a no-op when nothing is pending", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 100);

    debounced.flush();
    expect(callback).not.toHaveBeenCalled();
  });

  it("fires independent events once each when spaced beyond the delay", () => {
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 50);

    debounced("one");
    vi.advanceTimersByTime(60);
    debounced("two");
    vi.advanceTimersByTime(60);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, "one");
    expect(callback).toHaveBeenNthCalledWith(2, "two");
  });
});
