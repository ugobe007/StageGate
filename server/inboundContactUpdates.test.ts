import { describe, expect, it } from "vitest";
import {
  extractAnnouncedEmails,
  looksLikeContactChangeReply,
} from "./inboundContactUpdates.js";

const ULRICH_REPLY = `Hi,

As part of our mailbox reorganization from CAJA to Fives, my email address has changed.

New email: ulrich.toft@fivesgroup.com<mailto:ishay.ankori@fivesgroup.com>

Please make sure to use this address for all new communications.
My old mailbox will be suspended soon.

Thanks for updating your records.

Sincerely,
Ulrich Toft`;

describe("inboundContactUpdates", () => {
  it("extracts announced new email from mailbox migration auto-reply", () => {
    const emails = extractAnnouncedEmails(ULRICH_REPLY);
    expect(emails).toContain("ulrich.toft@fivesgroup.com");
    expect(emails).not.toContain("ishay.ankori@fivesgroup.com");
  });

  it("detects contact-change auto-replies", () => {
    expect(
      looksLikeContactChangeReply(
        'Automatic reply: Introducing myself — deployment notes for Caja Robotics',
        ULRICH_REPLY,
      ),
    ).toBe(true);
  });

  it("extracts reach-me-at patterns", () => {
    const emails = extractAnnouncedEmails("Please reach me at jane.doe@acmerobots.com going forward.");
    expect(emails).toContain("jane.doe@acmerobots.com");
  });

  it("ignores internal StageGate addresses", () => {
    const emails = extractAnnouncedEmails("Contact cal@onstage.bot or bob@starsupportinc.com");
    expect(emails).toHaveLength(0);
  });
});
