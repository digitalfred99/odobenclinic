import { describe, expect, it } from "vitest";
import { serializeCsv } from "./csv";

describe("serializeCsv", () => {
  it("quotes commas, quotes, and line breaks using CSV record separators", () => {
    expect(serializeCsv([
      ["Name", "Area"],
      ['Patient "A", Sr.', "North\nDistrict"],
    ])).toBe('"Name","Area"\r\n"Patient ""A"", Sr.","North\nDistrict"');
  });

  it("neutralizes spreadsheet formula prefixes without changing numeric values", () => {
    expect(serializeCsv([["=1+1", "  @SUM(A1:A2)", -12]])).toBe('"\'=1+1","\'  @SUM(A1:A2)","-12"');
  });
});