import { describe, expect, it } from "vitest";
import {
  ALL_SCHEDULE_STATUSES,
  getScheduleStatusAppearance,
  getScheduleStatusBadgeClassName,
  getScheduleStatusBlockClassName,
  isScheduleStatus,
} from "@/lib/status-colors";

describe("schedule status colors", () => {
  it("maps every workflow status to distinct block and badge classes", () => {
    expect(ALL_SCHEDULE_STATUSES).toHaveLength(9);
    for (const status of ALL_SCHEDULE_STATUSES) {
      const appearance = getScheduleStatusAppearance(status);
      expect(appearance.blockClassName.length).toBeGreaterThan(0);
      expect(appearance.badgeClassName.length).toBeGreaterThan(0);
    }
  });

  it("uses grey for scheduled / à faire", () => {
    expect(getScheduleStatusBlockClassName("scheduled")).toContain("slate");
    expect(getScheduleStatusBadgeClassName("scheduled")).toContain("slate");
  });

  it("uses blue for en-route", () => {
    expect(getScheduleStatusBlockClassName("en-route")).toContain("blue");
  });

  it("uses orange for in-progress", () => {
    expect(getScheduleStatusBlockClassName("in-progress")).toContain("orange");
  });

  it("uses green for completed", () => {
    expect(getScheduleStatusBlockClassName("completed")).toContain("green");
  });

  it("uses violet for paid", () => {
    expect(getScheduleStatusBlockClassName("paid")).toContain("violet");
  });

  it("uses strikethrough for cancelled", () => {
    expect(getScheduleStatusBlockClassName("cancelled")).toContain("line-through");
    expect(getScheduleStatusBadgeClassName("cancelled")).toContain("line-through");
  });

  it("recognizes schedule statuses only", () => {
    expect(isScheduleStatus("scheduled")).toBe(true);
    expect(isScheduleStatus("paid")).toBe(true);
    expect(isScheduleStatus("draft")).toBe(false);
    expect(isScheduleStatus("active")).toBe(false);
  });

  it("uses static full class strings for every workflow status block", () => {
    for (const status of ALL_SCHEDULE_STATUSES) {
      const className = getScheduleStatusBlockClassName(status);
      expect(className).toMatch(/^[\w\-:/\[\].% ]+$/);
      expect(className).not.toMatch(/\$\{/);
      expect(className.split(" ").every((token) => token.length > 0)).toBe(true);
    }
  });

  it("falls back to scheduled styling for unknown schedule keys at runtime", () => {
    const fallback = getScheduleStatusAppearance("scheduled");
    expect(getScheduleStatusAppearance("scheduled")).toEqual(fallback);
  });
});
