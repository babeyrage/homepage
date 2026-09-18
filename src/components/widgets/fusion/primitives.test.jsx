// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FUSION_COLORS, HighlightColors, useHighlightColor, useLastUpdatedLabel } from "./primitives";

import { BlockHighlightContext } from "components/services/widget/highlight-context";
import { buildHighlightConfig } from "utils/highlights";

function HighlightProbe({ fieldKey, value, fallback }) {
  const color = useHighlightColor(fieldKey, value, fallback);
  return <div data-testid="color">{color ?? "null"}</div>;
}

function AgeProbe({ data }) {
  const label = useLastUpdatedLabel(data);
  return <div data-testid="age">{label ?? "undefined"}</div>;
}

describe("components/widgets/fusion/primitives", () => {
  describe("useHighlightColor", () => {
    it("returns the fallback when no highlight context is provided", () => {
      render(<HighlightProbe fieldKey="ping" value={150} fallback={FUSION_COLORS.ok} />);
      expect(screen.getByTestId("color")).toHaveTextContent(FUSION_COLORS.ok);
    });

    it("maps a matching danger-level rule to the danger color, overriding the built-in fallback", () => {
      const highlightConfig = buildHighlightConfig(null, {
        ping: { numeric: { when: "gt", value: 100, level: "danger" } },
      });

      render(
        <BlockHighlightContext.Provider value={highlightConfig}>
          <HighlightProbe fieldKey="ping" value={150} fallback={FUSION_COLORS.ok} />
        </BlockHighlightContext.Provider>,
      );

      expect(screen.getByTestId("color")).toHaveTextContent(FUSION_COLORS.bad);
    });

    it("falls back to the built-in default when the configured rule doesn't match the current value", () => {
      const highlightConfig = buildHighlightConfig(null, {
        ping: { numeric: { when: "gt", value: 100, level: "danger" } },
      });

      render(
        <BlockHighlightContext.Provider value={highlightConfig}>
          <HighlightProbe fieldKey="ping" value={10} fallback={FUSION_COLORS.ok} />
        </BlockHighlightContext.Provider>,
      );

      expect(screen.getByTestId("color")).toHaveTextContent(FUSION_COLORS.ok);
    });
  });

  // HighlightColors exists specifically so a widget can resolve highlight
  // colors *inside* Container's children — a fusion Component's own
  // top-level body runs before Container mounts and would otherwise always
  // see the default null context (this was a real bug: the four LED-fixed
  // widgets called useHighlightColor directly in Component, so a configured
  // service.widget.highlight override was silently never applied).
  describe("HighlightColors", () => {
    it("resolves a color via the provided context when rendered as a Container descendant", () => {
      const highlightConfig = buildHighlightConfig(null, {
        outdated: { numeric: { when: "gt", value: 5, level: "warn" } },
      });

      render(
        <BlockHighlightContext.Provider value={highlightConfig}>
          <HighlightColors>
            {(getColor) => <div data-testid="color">{getColor("outdated", 6, FUSION_COLORS.ok) ?? "null"}</div>}
          </HighlightColors>
        </BlockHighlightContext.Provider>,
      );

      expect(screen.getByTestId("color")).toHaveTextContent(FUSION_COLORS.warn);
    });

    it("falls back to the given default when no context is provided at all", () => {
      render(
        <HighlightColors>
          {(getColor) => <div data-testid="color">{getColor("outdated", 6, FUSION_COLORS.ok) ?? "null"}</div>}
        </HighlightColors>,
      );

      expect(screen.getByTestId("color")).toHaveTextContent(FUSION_COLORS.ok);
    });
  });

  describe("useLastUpdatedLabel", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns undefined until data has arrived at least once", () => {
      render(<AgeProbe data={undefined} />);
      expect(screen.getByTestId("age")).toHaveTextContent("undefined");
    });

    it("labels freshly-arrived data as 'just now', then ages it as time passes", () => {
      const first = { value: 1 };
      const { rerender } = render(<AgeProbe data={undefined} />);
      expect(screen.getByTestId("age")).toHaveTextContent("undefined");

      act(() => {
        rerender(<AgeProbe data={first} />);
      });
      expect(screen.getByTestId("age")).toHaveTextContent("just now");

      act(() => {
        vi.advanceTimersByTime(65_000);
      });
      expect(screen.getByTestId("age")).toHaveTextContent("1m ago");
    });

    it("resets the age when a new data reference arrives", () => {
      const first = { value: 1 };
      const second = { value: 2 };
      const { rerender } = render(<AgeProbe data={undefined} />);

      act(() => {
        rerender(<AgeProbe data={first} />);
      });
      act(() => {
        vi.advanceTimersByTime(65_000);
      });
      expect(screen.getByTestId("age")).toHaveTextContent("1m ago");

      act(() => {
        rerender(<AgeProbe data={second} />);
      });
      expect(screen.getByTestId("age")).toHaveTextContent("just now");
    });
  });
});
