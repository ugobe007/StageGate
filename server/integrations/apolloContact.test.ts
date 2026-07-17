import { describe, expect, it } from "vitest";
import { isGuessedRoleInbox } from "../outreachContacts.js";
import { apolloEnabled } from "./apolloContact.js";

describe("apolloContact", () => {
  it("reports disabled without APOLLO_API_KEY", () => {
    const prev = process.env.APOLLO_API_KEY;
    delete process.env.APOLLO_API_KEY;
    expect(apolloEnabled()).toBe(false);
    if (prev) process.env.APOLLO_API_KEY = prev;
  });

  it("rejects generic inboxes for outreach", () => {
    expect(isGuessedRoleInbox("sales@fanuc.com")).toBe(true);
    expect(isGuessedRoleInbox("jane.smith@fanuc.com")).toBe(false);
  });
});
