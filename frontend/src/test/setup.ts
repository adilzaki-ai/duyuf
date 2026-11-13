import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/* Without vitest globals, Testing Library cannot unmount on its own: each test starts on an empty page. */
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
