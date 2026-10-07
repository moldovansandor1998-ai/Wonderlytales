import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("@/lib/auth", () => ({ authEnabled: () => true, createServerSupabase: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/login/login-form", () => ({ default: () => null }));
import LoginPage from "@/app/login/page";
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "confirmed-user" } }, error: null }); });
it("lets an already authenticated email session reach password setup", async () => {
  await expect(LoginPage({ searchParams: { next: "/auth/update-password" } })).rejects.toThrow("redirect:/auth/update-password");
});
it("does not accept an external destination for the authenticated session", async () => {
  await expect(LoginPage({ searchParams: { next: "/\\evil.example" } })).rejects.toThrow("redirect:/");
});
it("does not redirect a rejected session into password setup", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
  const form = await LoginPage({ searchParams: { next: "/auth/update-password" } });
  expect(form).toBeTruthy();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
