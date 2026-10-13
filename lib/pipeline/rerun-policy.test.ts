import { describe, expect, it } from "vitest";
import type { SessionStatus } from "@/lib/db/enums";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { Settings } from "@/lib/settings/schema";
import { shouldRerunOnDisagreement } from "./rerun-policy";

const withFlag = (rerunOnDisagreement: boolean): Settings => ({
  ...DEFAULT_SETTINGS,
  verification: { ...DEFAULT_SETTINGS.verification, rerunOnDisagreement },
});

const cases: [boolean, number, number, SessionStatus, boolean][] = [
  [true, 3, 1, "done", true],
  [true, 5, 1, "partial", true],
  [true, 2, 1, "done", false],
  [true, 3, 2, "done", false],
  [true, 3, 1, "failed", false],
  [false, 3, 1, "done", false],
  [false, 2, 2, "failed", false],
];

describe("shouldRerunOnDisagreement", () => {
  it.each(cases)(
    "enabled=%s disputed=%i attempt=%i status=%s -> %s",
    (on, disputed, attempt, status, want) => {
      expect(shouldRerunOnDisagreement(withFlag(on), { status, disputed, attempt })).toBe(want);
    },
  );
});
