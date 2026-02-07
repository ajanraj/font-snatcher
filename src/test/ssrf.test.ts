import {
  assertSafeTargetUrl,
  isBlockedHostname,
  isPrivateIpAddress,
} from "@/server/font-extractor/ssrf";

describe("ssrf guards", () => {
  it("detects blocked hostnames", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("api.service.local")).toBe(true);
    expect(isBlockedHostname("linear.app")).toBe(false);
  });

  it("detects private ip addresses", () => {
    expect(isPrivateIpAddress("10.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
  });

  it("rejects localhost urls", async () => {
    const target = new URL("https://localhost/font.woff2");
    await expect(assertSafeTargetUrl(target)).rejects.toThrow("Blocked target host");
  });

  it("rejects private ip urls", async () => {
    const target = new URL("https://10.0.0.12/font.woff2");
    await expect(assertSafeTargetUrl(target)).rejects.toThrow("Blocked private target IP");
  });
});
