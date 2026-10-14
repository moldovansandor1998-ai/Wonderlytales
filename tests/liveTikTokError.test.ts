import { expect,it } from "vitest";
import { tikTokFailure, tikTokDiagnostics } from "@/lib/live/tiktok-error";
it("classifies signing and rate limits without exposing provider payloads",()=>{
  class SignAPIError extends Error {} class SignatureRateLimitError extends Error {}
  const signer=tikTokFailure({exception:new SignAPIError("token=secret; cookies=private")});
  expect(signer.code).toBe("TIKTOK_SIGN_SERVICE");expect(JSON.stringify(signer)).not.toContain("secret");
  expect(tikTokFailure(new SignatureRateLimitError("429")).code).toBe("TIKTOK_RATE_LIMIT");
});
it("recognizes production-minified SDK errors and deeply wrapped HTTP failures",()=>{
  class a extends Error {}
  expect(tikTokFailure(new a("The requested user isn't online :( ")).code).toBe("TIKTOK_OFFLINE");
  expect(tikTokFailure(Object.assign(new a("private payload"),{reason:"Rate Limited"})).code).toBe("TIKTOK_RATE_LIMIT");
  expect(tikTokFailure({config:{requestErrs:[{cause:{response:{status:429}}}]}}).code).toBe("TIKTOK_RATE_LIMIT");
});
it("logs only allowlisted diagnostic labels and handles cyclic provider errors",()=>{
  const error={message:"token=secret",config:{routeId:"fetchRoomIdRoute",requestErrs:[{message:"Failed to extract the SIGI_STATE HTML tag cookie=private",response:{statusCode:403}}]},cause:null as unknown};
  error.cause=error;
  expect(tikTokDiagnostics(error)).toEqual([{route:"fetchRoomIdRoute",htmlMissing:false,permission:false,offline:false,timeout:false},{route:"unknown",http:403,htmlMissing:true,permission:false,offline:false,timeout:false}]);
  expect(JSON.stringify(tikTokDiagnostics(error))).not.toMatch(/secret|private/);
  expect(tikTokFailure(error).code).toBe("TIKTOK_CONNECT_FAILED");
});
it("finds a classified error in a composite room lookup",()=>{
  class ConnectTimeoutError extends Error {}
  expect(tikTokFailure({config:{requestErrs:[new ConnectTimeoutError("timed out")]}}).code).toBe("TIKTOK_TIMEOUT");
});
