import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

const DONATION_AMOUNT = 1_000_000; // 1 STX

describe("Post-Conditions Best Practices - donation-tracker", () => {
  beforeEach(() => {
    simnet.mineEmptyBlock();
  });

  describe("SCENARIO 1: Simple STX Transfer", () => {
    it("allows user to donate STX to contract", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      expect(result.result).toBeOk(Cl.uint(DONATION_AMOUNT));

      // Check donation was recorded
      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(DONATION_AMOUNT));

      // Check total was updated
      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(DONATION_AMOUNT));
    });

    it("accumulates multiple donations from same donor", () => {
      // First donation
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      // Second donation
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(DONATION_AMOUNT * 2));
    });

    it("rejects zero amount donations", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(0)],
        alice
      );

      expect(result.result).toBeErr(Cl.uint(100)); // ERR_ZERO_AMOUNT
    });

    it("tracks donations from multiple donors independently", () => {
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT * 2)],
        bob
      );

      const aliceDonation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(aliceDonation.result).toBeOk(Cl.uint(DONATION_AMOUNT));

      const bobDonation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(bob)],
        bob
      );
      expect(bobDonation.result).toBeOk(Cl.uint(DONATION_AMOUNT * 2));

      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(DONATION_AMOUNT * 3));
    });
  });

  describe("SCENARIO 2: Multiple Transfers", () => {
    it("splits donation between contract and recipient", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "split-donation",
        [Cl.uint(DONATION_AMOUNT), Cl.principal(bob)],
        alice
      );

      const half = DONATION_AMOUNT / 2;
      expect(result.result).toBeOk(Cl.uint(half));

      // Check only half was tracked (the half to contract)
      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(half));

      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(half));
    });

    it("requires amount > 1 to avoid zero half", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "split-donation",
        [Cl.uint(1), Cl.principal(bob)],
        alice
      );

      expect(result.result).toBeErr(Cl.uint(100)); // ERR_ZERO_AMOUNT
    });

    it("handles odd amounts correctly (rounds down)", () => {
      const oddAmount = 1_000_001; // 1.000001 STX
      const result = simnet.callPublicFn(
        "donation-tracker",
        "split-donation",
        [Cl.uint(oddAmount), Cl.principal(bob)],
        alice
      );

      const half = Math.floor(oddAmount / 2); // 500000
      expect(result.result).toBeOk(Cl.uint(half));
    });
  });

  describe("SCENARIO 3: Read-only functions", () => {
    it("returns contract balance (total raised)", () => {
      // Start with zero
      const initialBalance = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-contract-balance",
        [],
        alice
      );
      expect(initialBalance.result).toBeOk(Cl.uint(0));

      // Add donations
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT * 2)],
        bob
      );

      // Check updated balance
      const finalBalance = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-contract-balance",
        [],
        alice
      );
      expect(finalBalance.result).toBeOk(Cl.uint(DONATION_AMOUNT * 3));
    });
  });

  describe("SCENARIO 3: Conditional Transfer", () => {
    it("allows first-time donation", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      expect(result.result).toBeOk(Cl.uint(DONATION_AMOUNT));

      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(DONATION_AMOUNT));
    });

    it("prevents second donation from same donor", () => {
      // First donation succeeds
      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      // Second donation fails
      const result = simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      expect(result.result).toBeErr(Cl.uint(102)); // ERR_ALREADY_DONATED

      // Original donation unchanged
      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(DONATION_AMOUNT));
    });

    it("rejects zero amount", () => {
      const result = simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(0)],
        alice
      );

      expect(result.result).toBeErr(Cl.uint(100)); // ERR_ZERO_AMOUNT
    });

    it("allows different donors to donate once each", () => {
      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT * 2)],
        bob
      );

      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT * 3)],
        charlie
      );

      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(DONATION_AMOUNT * 6));
    });
  });

  describe("SCENARIO 4: Additional read-only checks", () => {
    it("returns zero for donor with no donations", () => {
      const donation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(donation.result).toBeOk(Cl.uint(0));
    });

    it("returns correct total when no donations", () => {
      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(0));
    });

    it("tracks total across all donation methods", () => {
      // Regular donate
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      // Split donation (half goes to contract)
      simnet.callPublicFn(
        "donation-tracker",
        "split-donation",
        [Cl.uint(DONATION_AMOUNT * 2), Cl.principal(bob)],
        alice
      );

      // Donate-once
      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT)],
        bob
      );

      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );

      // 1M (donate) + 1M (split half) + 1M (donate-once) = 3M
      expect(total.result).toBeOk(Cl.uint(DONATION_AMOUNT * 3));
    });
  });

  describe("Integration: Complex workflows", () => {
    it("handles mixed donation patterns", () => {
      // Alice donates normally twice
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );
      simnet.callPublicFn(
        "donation-tracker",
        "donate",
        [Cl.uint(DONATION_AMOUNT)],
        alice
      );

      // Bob does donate-once
      simnet.callPublicFn(
        "donation-tracker",
        "donate-once",
        [Cl.uint(DONATION_AMOUNT * 3)],
        bob
      );

      // Charlie splits donation
      simnet.callPublicFn(
        "donation-tracker",
        "split-donation",
        [Cl.uint(DONATION_AMOUNT * 4), Cl.principal(alice)],
        charlie
      );

      // Check individual balances
      const aliceDonation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(alice)],
        alice
      );
      expect(aliceDonation.result).toBeOk(Cl.uint(DONATION_AMOUNT * 2));

      const bobDonation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(bob)],
        bob
      );
      expect(bobDonation.result).toBeOk(Cl.uint(DONATION_AMOUNT * 3));

      const charlieDonation = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-donation",
        [Cl.principal(charlie)],
        charlie
      );
      expect(charlieDonation.result).toBeOk(Cl.uint(DONATION_AMOUNT * 2)); // Half of 4M

      // Check total: 2M (alice) + 3M (bob) + 2M (charlie) = 7M
      const total = simnet.callReadOnlyFn(
        "donation-tracker",
        "get-total-raised",
        [],
        alice
      );
      expect(total.result).toBeOk(Cl.uint(DONATION_AMOUNT * 7));
    });
  });
});
