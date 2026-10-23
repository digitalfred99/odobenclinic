import { afterEach, describe, expect, it, vi } from "vitest";
import {
  scheduleScrollElementIntoView,
  scrollToFirstInvalidField,
} from "./scroll-to-first-invalid-field";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("scrollToFirstInvalidField", () => {
  it("scrolls only the first invalid field into view without focusing it", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input aria-invalid="true" />
      <select aria-invalid="true"></select>
    `;
    const [firstField, secondField] = Array.from(form.querySelectorAll<HTMLElement>("input, select"));
    const firstScroll = vi.fn();
    const secondScroll = vi.fn();
    firstField.scrollIntoView = firstScroll;
    secondField.scrollIntoView = secondScroll;
    const focus = vi.spyOn(firstField, "focus");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    scrollToFirstInvalidField(form);

    expect(firstScroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(secondScroll).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("uses immediate scrolling when reduced motion is preferred", () => {
    const form = document.createElement("form");
    form.innerHTML = '<input aria-invalid="true" />';
    const field = form.querySelector<HTMLInputElement>("input");
    const scroll = vi.fn();
    if (!field) throw new Error("Expected invalid input");
    field.scrollIntoView = scroll;
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    scrollToFirstInvalidField(form);

    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("schedules an explicitly identified invalid control for scrolling", () => {
    const element = document.createElement("input");
    const scroll = vi.fn();
    element.scrollIntoView = scroll;
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    scheduleScrollElementIntoView(element);

    expect(scroll).not.toHaveBeenCalled();
    frames.forEach((callback) => callback(0));
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });
});
