import { describe, expect, it } from "vitest";
import { enteredGenders } from "../src/domain/categories";

describe("the gender of each entered Participant", () => {
  it("follows the Division for singles and same-gender Pairs", () => {
    expect(enteredGenders("women", ["herr"])).toEqual(["F"]);
    expect(enteredGenders("mens_pair", ["frau", "none"])).toEqual(["M", "M"]);
  });

  it("lets the Titles decide who is the woman in a Mixed pair, in either order", () => {
    expect(enteredGenders("mixed_pair", ["frau", "herr"])).toEqual(["F", "M"]);
    expect(enteredGenders("mixed_pair", ["herr", "frau"])).toEqual(["M", "F"]);
    expect(enteredGenders("mixed_pair", ["herr", "dr"])).toEqual(["M", "F"]);
    expect(enteredGenders("mixed_pair", ["kids", "frau"])).toEqual(["M", "F"]);
    expect(enteredGenders("mixed_pair", ["dr", "herr"])).toEqual(["F", "M"]);
  });

  it("keeps the entered order of a Mixed pair when the Titles don't tell", () => {
    expect(enteredGenders("mixed_pair", ["none", "dr"])).toEqual(["F", "M"]);
    expect(enteredGenders("mixed_pair", ["herr", "herr"])).toEqual(["F", "M"]);
    expect(enteredGenders("mixed_pair", ["frau", "frau"])).toEqual(["F", "M"]);
  });
});
