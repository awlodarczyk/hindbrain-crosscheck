import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_CLAIMS, extractJsonBlock, parseReview, repairJson } from "./claims-parser";

const fx = (name: string) => readFileSync(`tests/fixtures/reviews/${name}`, "utf8");
const opts = { requireSourcePerClaim: false };
const wrap = (claims: unknown[]) => "```json\n" + JSON.stringify({ claims }) + "\n```";

describe("fixtures", () => {
  it("clean", () => {
    const r = parseReview(fx("clean.md"), opts);
    expect(r.parseStatus).toBe("json");
    expect(r.claims.map((c) => c.verdict)).toEqual([
      "supported",
      "disputed",
      "supported",
      "supported",
    ]);
    expect(r.claims[0]?.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/10694106/");
    expect(r.claims[0]?.sourceTitle).toBe("PubMed");
    expect(r.overall).toBe("Mostly accurate; one claim overstated.");
  });
  it("prose-only", () => {
    const text = fx("prose-only.md");
    const r = parseReview(text, opts);
    expect(r.parseStatus).toBe("fallback");
    expect(r.warnings).toEqual(["no_json_block"]);
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0]?.claim).toBe(text.trim().slice(0, 200));
    expect(r.claims[0]?.verdict).toBe("unverifiable");
    expect(r.claims[0]?.note).toBe("Reviewer returned prose; see Raw.");
    expect(r.overall).toBeNull();
  });
  it("fenced-with-prose", () => {
    const r = parseReview(fx("fenced-with-prose.md"), opts);
    expect(r.parseStatus).toBe("json");
    expect(r.claims).toHaveLength(1);
  });
  it("invalid-verdict", () => {
    const r = parseReview(fx("invalid-verdict.md"), opts);
    expect(r.claims[0]?.verdict).toBe("unverifiable");
    expect(r.warnings).toContain("invalid_verdict:0");
  });
  it("two-blocks uses last", () => {
    const r = parseReview(fx("two-blocks.md"), opts);
    expect(r.overall).toBe("second");
    expect(r.claims[0]?.claim).toBe("Second claim here");
  });
  it("trailing-comma", () => {
    const r = parseReview(fx("trailing-comma.md"), opts);
    expect(r.parseStatus).toBe("json");
    expect(r.claims[0]?.verdict).toBe("partial");
  });
  it("bare-object", () => {
    const r = parseReview(fx("bare-object.md"), opts);
    expect(r.parseStatus).toBe("json");
    expect(r.claims[0]?.sourceUrl).toBe("https://example.com/a");
    expect(r.claims[0]?.sourceTitle).toBeNull();
  });
  it("huge-prose is fast", () => {
    const text = fx("huge-prose.md");
    expect(text.length).toBeGreaterThan(150_000);
    const t0 = performance.now();
    const r = parseReview(text, opts);
    expect(performance.now() - t0).toBeLessThan(200);
    expect(r.parseStatus).toBe("fallback");
  });
  it("mock-answers review", () => {
    const text = (
      JSON.parse(readFileSync("tests/fixtures/mock-answers.json", "utf8")) as {
        review: { text: string };
      }
    ).review.text;
    const r = parseReview(text, opts);
    expect(r.claims).toHaveLength(4);
    expect(r.claims.filter((c) => c.verdict === "disputed")).toHaveLength(1);
  });
});

describe("rules", () => {
  it("empty string", () => {
    const r = parseReview("", opts);
    expect(r.claims[0]?.claim).toBe("Reviewer returned no text.");
  });
  it("json_parse_failed", () => {
    const r = parseReview("```json\n{ nope }\n```", opts);
    expect(r.warnings).toEqual(["json_parse_failed"]);
    expect(r.parseStatus).toBe("fallback");
  });
  it("json_shape_invalid", () => {
    const r = parseReview('```json\n{"claims":"x"}\n```', opts);
    expect(r.warnings).toEqual(["json_shape_invalid"]);
  });
  it("requireSourcePerClaim", () => {
    const text = wrap([{ claim: "No source claim", verdict: "supported", note: "orig" }]);
    const r = parseReview(text, { requireSourcePerClaim: true });
    expect(r.claims[0]?.verdict).toBe("unverifiable");
    expect(r.claims[0]?.note).toBe("No source given. orig");
    const r2 = parseReview(wrap([{ claim: "No source claim", verdict: "supported" }]), {
      requireSourcePerClaim: true,
    });
    expect(r2.claims[0]?.note).toBe("No source given.");
    expect(parseReview(text, opts).claims[0]?.verdict).toBe("supported");
  });
  it("invalid url dropped", () => {
    const r = parseReview(
      wrap([
        { claim: "Bad url one", verdict: "supported", source: { url: "ftp://x.com" } },
        { claim: "Bad url two", verdict: "supported", source: { url: "not a url" } },
      ]),
      opts,
    );
    expect(r.claims.map((c) => c.sourceUrl)).toEqual([null, null]);
    expect(r.warnings).toEqual(["invalid_source_url:0", "invalid_source_url:1"]);
  });
  it("dedupe", () => {
    const r = parseReview(
      wrap([
        { claim: "Same claim", verdict: "supported" },
        { claim: "  same CLAIM ", verdict: "disputed" },
      ]),
      opts,
    );
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0]?.verdict).toBe("supported");
    expect(r.warnings).toEqual(["duplicate_claim:1"]);
  });
  it("too many claims", () => {
    const claims = Array.from({ length: MAX_CLAIMS + 1 }, (_, i) => ({
      claim: `Claim number ${i}`,
      verdict: "supported",
    }));
    const r = parseReview(wrap(claims), opts);
    expect(r.claims).toHaveLength(MAX_CLAIMS);
    expect(r.warnings).toEqual(["too_many_claims"]);
  });
  it("truncates long claim, trims note, empty note null", () => {
    const r = parseReview(
      wrap([
        { claim: "x".repeat(600), verdict: "supported", note: "  hi " },
        { claim: "Empty note", verdict: "supported", note: "   " },
      ]),
      opts,
    );
    expect(r.claims[0]?.claim).toBe("x".repeat(500) + "…");
    expect(r.claims[0]?.note).toBe("hi");
    expect(r.claims[1]?.note).toBeNull();
  });
  it("blank overall is null", () => {
    expect(parseReview('{"overall":"  ","claims":[]}', opts).overall).toBeNull();
  });
});

describe("helpers", () => {
  it("extractJsonBlock", () => {
    expect(extractJsonBlock("no braces")).toBeNull();
    expect(extractJsonBlock('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonBlock("```\nplain text\n```")).toBeNull();
    expect(extractJsonBlock("x } y")).toBeNull();
    expect(extractJsonBlock('pre {"a":{"b":1}} post')).toBe('{"a":{"b":1}}');
  });
  it("repairJson", () => {
    expect(repairJson('﻿ {"a":[1,2,],} ')).toBe('{"a":[1,2]}');
  });
});
