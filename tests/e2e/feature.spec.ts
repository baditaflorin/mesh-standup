import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer test for the advertised core action:
 * "round-robin standup timer" — one speaker at a time has the floor, and
 * when peer A advances the baton (the non-ArUco "Skip / next" control) the
 * OPPOSITE peer (B) must see the active speaker change AND the synced
 * countdown timer running. We also drive the "+30s" extend control on peer A
 * and assert peer B's shared countdown climbs past a full minute. This is all
 * mesh state, fully testable WITHOUT a camera; the ArUco baton-pass is an
 * optional alternate trigger over the same Yjs `session` map.
 */

/** Set the peer's name via the Settings drawer, then arm the standup. */
async function joinAs(page: Page, name: string): Promise<void> {
  // Open the settings drawer if it is not already mounted.
  const drawer = page.locator(".mesh-settings-drawer, .settings-drawer");
  if ((await drawer.count()) === 0) {
    await page.getByLabel("Open settings").click();
  }
  await page.getByPlaceholder("Alex").fill(name);
  // Close the drawer so the "Connect to standup" button is reachable.
  await page.getByLabel("Close").click();
  await page.getByRole("button", { name: /Connect to standup/i }).click();
  // Once armed the round-robin stage is visible (the HUD shows "phones").
  await expect(page.getByText(/phones/i).first()).toBeVisible();
}

test("round-robin baton advance on peer A is seen by peer B with a synced timer", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await joinAs(a, "Ada");
    await joinAs(b, "Bo");

    // Both peers must converge on the same 2-person roster (CRDT sync).
    await expect(a.locator(".standup-roster-name")).toHaveCount(2);
    await expect(b.locator(".standup-roster-name")).toHaveCount(2);
    await expect(a.locator(".standup-roster-name", { hasText: "Bo" })).toBeVisible();
    await expect(b.locator(".standup-roster-name", { hasText: "Ada" })).toBeVisible();

    // Both peers must agree on the SAME roster order (CRDT determinism) so
    // that "slot 0" / "slot 1" mean the same person on every phone. We read
    // the order from peer A and assert peer B is identical, then drive the
    // baton by SLOT and assert by NAME on the opposite peer.
    const order = await a.locator(".standup-roster-name").allTextContents();
    expect(order).toHaveLength(2);
    await expect(b.locator(".standup-roster-name")).toHaveText(order);
    const firstSpeaker = order[0]!;
    const secondSpeaker = order[1]!;

    // Peer A starts the round: speaker slot 0 takes the floor.
    await a.getByRole("button", { name: /Start round/i }).click();

    // CROSS-PEER ASSERTION #1: peer B sees slot-0 as the active speaker — the
    // turn state propagated A → B over the Yjs `session` map.
    await expect(b.locator(".standup-speaker strong")).toHaveText(firstSpeaker);
    await expect(b.locator(".standup-roster-active .standup-roster-name")).toHaveText(firstSpeaker);

    // CROSS-PEER ASSERTION #2: the countdown is running on peer B — i.e. the
    // synced timer shows a non-zero time (the slot just started).
    await expect(b.locator(".standup-time")).not.toHaveText("0:00");

    // Peer A advances the baton with the manual "Skip / next" control.
    await a.getByRole("button", { name: /Skip \/ next/i }).click();

    // CROSS-PEER ASSERTION #3: the active speaker on peer B advanced to slot-1
    // — the round-robin baton genuinely crossed the mesh, no camera involved.
    await expect(b.locator(".standup-speaker strong")).toHaveText(secondSpeaker);
    await expect(b.locator(".standup-roster-active .standup-roster-name")).toHaveText(
      secondSpeaker,
    );
    // And peer A agrees (the write originated there).
    await expect(a.locator(".standup-speaker strong")).toHaveText(secondSpeaker);

    // CROSS-PEER ASSERTION #4: the "+30s" extend control on peer A lengthens
    // the running slot for peer B too. The default slot is 60s, so a slot that
    // just started can never show more than 0:59 remaining; after +30s, peer B
    // must see the countdown climb above a full minute (≥ 1:01). We poll the
    // mm:ss text on peer B and require it to cross 61s — only the shared
    // `startedAt` bump (not local state) can produce that.
    await a.getByRole("button", { name: /\+30s/i }).click();
    await expect
      .poll(async () => parseClock(await b.locator(".standup-time").innerText()), {
        message: "peer B's countdown should climb past 60s after peer A taps +30s",
      })
      .toBeGreaterThan(61);
  } finally {
    await cleanup();
  }
});

/** Parse an "m:ss" countdown string into total seconds. */
function parseClock(text: string): number {
  const m = /(\d+):(\d{2})/.exec(text.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}
