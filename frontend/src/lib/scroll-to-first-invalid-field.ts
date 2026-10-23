export function scrollToFirstInvalidField(form: HTMLFormElement | null): void {
  const firstInvalidField = form?.querySelector<HTMLElement>(
    'input[aria-invalid="true"]:not([type="hidden"]), select[aria-invalid="true"], textarea[aria-invalid="true"]'
  );

  scrollElementIntoView(firstInvalidField ?? null);
}

export function scheduleScrollElementIntoView(element: HTMLElement | null): void {
  window.requestAnimationFrame(() => scrollElementIntoView(element));
}

function scrollElementIntoView(element: HTMLElement | null): void {
  if (!element) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  element.scrollIntoView?.({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });
}

export function scheduleScrollToFirstInvalidField(form: HTMLFormElement | null): void {
  window.requestAnimationFrame(() => scrollToFirstInvalidField(form));
}
