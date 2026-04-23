import { describe, expect, it } from "vitest";

import type { PartyProfileBundleInput } from "../src/lib/contracts";
import {
  hasPartyProfileValidationErrors,
  parsePartyProfileZodErrorMessage,
  validatePartyProfileBundle,
} from "../src/lib/party-profile-validation";

function emptyBundle(): PartyProfileBundleInput {
  return {
    profile: {
      fullName: "",
      shortName: "",
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: null,
      businessActivityCode: null,
      businessActivityText: null,
      businessActivityTextI18n: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

describe("validatePartyProfileBundle", () => {
  it("returns no errors for a bundle without arrays", () => {
    expect(validatePartyProfileBundle(emptyBundle())).toEqual({});
  });

  it("flags empty representative fullName", () => {
    const bundle = emptyBundle();
    bundle.representatives = [
      {
        role: "director",
        fullName: "",
        fullNameI18n: null,
        title: null,
        titleI18n: null,
        basisDocument: null,
        basisDocumentI18n: null,
        isPrimary: false,
      },
    ];

    const errors = validatePartyProfileBundle(bundle);
    expect(errors).toEqual({
      "representatives.0.fullName": "Заполните поле",
    });
    expect(hasPartyProfileValidationErrors(errors)).toBe(true);
  });

  it("flags empty license licenseNumber", () => {
    const bundle = emptyBundle();
    bundle.licenses = [
      {
        licenseType: "company_license",
        licenseNumber: "  ",
        issuedBy: null,
        issuedByI18n: null,
        issuedAt: null,
        expiresAt: null,
        activityCode: null,
        activityText: null,
        activityTextI18n: null,
      },
    ];

    const errors = validatePartyProfileBundle(bundle);
    expect(errors).toEqual({
      "licenses.0.licenseNumber": "Заполните поле",
    });
  });

  it("flags empty identifier value and contact value", () => {
    const bundle = emptyBundle();
    bundle.identifiers = [{ scheme: "inn", value: "" }];
    bundle.contacts = [{ type: "email", value: "", isPrimary: false }];

    const errors = validatePartyProfileBundle(bundle);
    expect(errors).toEqual({
      "identifiers.0.value": "Заполните поле",
      "contacts.0.value": "Заполните поле",
    });
  });

  it("treats non-empty trimmed strings as valid", () => {
    const bundle = emptyBundle();
    bundle.representatives = [
      {
        role: "director",
        fullName: "Иванов",
        fullNameI18n: null,
        title: null,
        titleI18n: null,
        basisDocument: null,
        basisDocumentI18n: null,
        isPrimary: false,
      },
    ];

    expect(validatePartyProfileBundle(bundle)).toEqual({});
  });
});

describe("parsePartyProfileZodErrorMessage", () => {
  it("returns empty for non-string input", () => {
    expect(parsePartyProfileZodErrorMessage(undefined)).toEqual({});
    expect(parsePartyProfileZodErrorMessage(42)).toEqual({});
  });

  it("returns empty for non-JSON input", () => {
    expect(parsePartyProfileZodErrorMessage("oops")).toEqual({});
  });

  it("extracts partyProfile-scoped issues by dotted path", () => {
    const message = JSON.stringify([
      {
        code: "too_small",
        path: ["partyProfile", "representatives", 0, "fullName"],
        message: "Too small: expected string to have >=1 characters",
      },
      {
        code: "too_small",
        path: ["partyProfile", "licenses", 0, "licenseNumber"],
        message: "Too small: expected string to have >=1 characters",
      },
      {
        code: "invalid",
        path: ["unrelated", "field"],
        message: "ignored",
      },
    ]);

    expect(parsePartyProfileZodErrorMessage(message)).toEqual({
      "representatives.0.fullName":
        "Too small: expected string to have >=1 characters",
      "licenses.0.licenseNumber":
        "Too small: expected string to have >=1 characters",
    });
  });
});
