import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

if (!process.env.FONT_PROXY_SECRET) {
  process.env.FONT_PROXY_SECRET = "test-font-snatcher-secret-1234567890";
}

afterEach(() => {
  cleanup();
});
