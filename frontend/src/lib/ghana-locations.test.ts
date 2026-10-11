import { describe, expect, it } from "vitest";
import {
  ASIKUMA_ODOBEN_BRAKWA_TOWNS,
  CENTRAL_REGION_DISTRICTS,
  GHANA_REGIONS,
  getAreaSuggestions,
  getDistrictSuggestions,
  getTownSuggestions,
  ODOBEN_AREAS,
} from "./ghana-locations";

describe("Ghana location suggestions", () => {
  it("lists all sixteen regions and all Central Region administrative districts", () => {
    expect(GHANA_REGIONS).toHaveLength(16);
    expect(CENTRAL_REGION_DISTRICTS).toHaveLength(22);
    expect(CENTRAL_REGION_DISTRICTS).toContain("Asikuma-Odoben-Brakwa");
  });

  it("provides Asikuma-Odoben-Brakwa towns and Odoben areas", () => {
    expect(ASIKUMA_ODOBEN_BRAKWA_TOWNS).toContain("Odoben");
    expect(ASIKUMA_ODOBEN_BRAKWA_TOWNS.length).toBeGreaterThanOrEqual(10);
    expect(ODOBEN_AREAS).toEqual(expect.arrayContaining(["Awendadze", "Asomdweekrom", "Oforikrom"]));
  });

  it("adds saved custom locations to the correct parent suggestions", () => {
    const savedLocations = [
      { region: "Ashanti Region", district: "New District", town: "New Town", area: "New Area" },
      { region: "Central Region", district: "New District", town: "New Town", area: "New Area" },
    ];

    expect(getDistrictSuggestions(savedLocations, "Central Region")).toContain("New District");
    expect(getTownSuggestions(savedLocations, "Central Region", "New District")).toEqual(["New Town"]);
    expect(getAreaSuggestions(savedLocations, "Central Region", "New District", "New Town")).toEqual(["New Area"]);
    expect(getAreaSuggestions(savedLocations, "Ashanti Region", "New District", "New Town")).toEqual(["New Area"]);
  });
});
