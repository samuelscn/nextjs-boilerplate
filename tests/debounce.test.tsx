// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

describe("useDebouncedCallback", () => {
  it("collapses rapid calls into the last one, flushes on demand and drops pending calls on unmount", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(spy, 300));
    result.current.call("a"); result.current.call("ab"); vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledExactlyOnceWith("ab");
    result.current.call("now"); result.current.flush();
    expect(spy).toHaveBeenLastCalledWith("now");
    result.current.call("x"); unmount(); vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
