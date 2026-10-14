import { expect,it } from "vitest";
import { tikTokFailure } from "@/lib/live/tiktok-error";
it("classifies signing and rate limits without exposing provider payloads",()=>{
  class SignAPIError extends Error {} class SignatureRateLimitError extends Error {}
  const signer=tikTokFailure({exception:new SignAPIError("token=secret; cookies=private")});
  expect(signer.code).toBe("TIKTOK_SIGN_SERVICE");expect(JSON.stringify(signer)).not.toContain("secret");
  expect(tikTokFailure(new SignatureRateLimitError("429")).code).toBe("TIKTOK_RATE_LIMIT");
});
it("finds a classified error in a composite room lookup",()=>{
  class ConnectTimeoutError extends Error {}
  expect(tikTokFailure({config:{requestErrs:[new ConnectTimeoutError("timed out")]}}).code).toBe("TIKTOK_TIMEOUT");
});
