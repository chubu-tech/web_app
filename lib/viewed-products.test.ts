import { afterEach, describe, expect, it, vi } from "vitest";
import { claimProductView } from "./viewed-products";

/**
 * The suite has no jsdom, so `sessionStorage` is not defined — which is the first case, and a
 * real one: this module is imported by a client component that also renders on the server.
 */

function withStore(store: Partial<Storage>) {
  vi.stubGlobal("sessionStorage", store as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("claimProductView", () => {
  it("declines when there is no session storage at all", () => {
    // Node, and the server render. Nothing to claim against, so nothing is counted.
    expect(claimProductView("p1")).toBe(false);
  });

  it("claims a product once and then declines it", () => {
    const data = new Map<string, string>();
    withStore({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });

    expect(claimProductView("p1")).toBe(true);
    expect(claimProductView("p1")).toBe(false);
    expect(claimProductView("p1")).toBe(false);
  });

  it("counts different products separately", () => {
    const data = new Map<string, string>();
    withStore({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });

    expect(claimProductView("p1")).toBe(true);
    expect(claimProductView("p2")).toBe(true);
    expect(claimProductView("p1")).toBe(false);
  });

  /**
   * The gap a separate `hasSeen` / `markSeen` pair would leave open. React invokes effects
   * twice in development, so the second call must already see the first one's mark.
   */
  it("marks as it tests, so a double invoke counts once", () => {
    const data = new Map<string, string>();
    withStore({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });

    const claims = [claimProductView("p1"), claimProductView("p1")];
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  /**
   * Blocked site data raises on the accessor itself rather than returning empty. Declining is
   * the safe answer: an under-count loses signal quietly, an over-count lies on every remount.
   */
  it("declines rather than throwing when the store refuses to be read", () => {
    withStore({
      getItem: () => {
        throw new Error("The operation is insecure.");
      },
      setItem: () => {},
    });

    expect(() => claimProductView("p1")).not.toThrow();
    expect(claimProductView("p1")).toBe(false);
  });

  it("declines rather than throwing when the store refuses to be written", () => {
    withStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(claimProductView("p1")).toBe(false);
  });

  /** Namespaced, so a key cannot collide with the cart's or the loyalty card's. */
  it("namespaces its keys", () => {
    const written: string[] = [];
    withStore({
      getItem: () => null,
      setItem: (k: string) => void written.push(k),
    });

    claimProductView("abc");
    expect(written).toEqual(["tho.shop.viewed:abc"]);
  });
});
