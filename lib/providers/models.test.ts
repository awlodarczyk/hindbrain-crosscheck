import { describe, expect, it } from "vitest";
import { MODELS, defaultModelFor, findModel, modelsFor } from "./models";

describe("modelsFor", () => {
  it("returns only claude models for claude", () => {
    const list = modelsFor("claude");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => m.provider === "claude")).toBe(true);
  });

  it("returns only chatgpt models for chatgpt", () => {
    const list = modelsFor("chatgpt");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((m) => m.provider === "chatgpt")).toBe(true);
  });
});

describe("findModel", () => {
  it("finds gpt-5.5 by id", () => {
    expect(findModel("gpt-5.5")?.label).toBe("GPT-5.5");
  });

  it("returns undefined for an unknown id", () => {
    expect(findModel("nope")).toBeUndefined();
  });
});

describe("defaultModelFor", () => {
  it("returns the first chatgpt model", () => {
    expect(defaultModelFor("chatgpt").id).toBe("gpt-5.5");
  });

  it("returns the first claude model", () => {
    expect(defaultModelFor("claude").id).toBe("claude-opus-5-5");
  });
});

describe("prices", () => {
  it("every model has a positive input and output price and search price", () => {
    for (const m of MODELS) {
      expect(m.inputPerM, m.id).toBeGreaterThan(0);
      expect(m.outputPerM, m.id).toBeGreaterThan(0);
      expect(m.searchPer1k, m.id).toBeGreaterThan(0);
    }
  });
});
