import { describe, expect, it } from "vitest";
import { galleryFiltersSchema, sourceCredits } from "@/features/gallery/models";
import { treatmentSchema } from "@/features/patients/schemas";
describe("gallery classification boundaries", () => {
  it("rejects reversed upload dates and unsupported genders", () => {
    expect(galleryFiltersSchema.safeParse({uploadedFrom:"2026-11-14",uploadedTo:"2026-11-01"}).success).toBe(false);
    expect(galleryFiltersSchema.safeParse({gender:"guessed"}).success).toBe(false);
  });
  it("does not render executable source links", () => {
    expect(sourceCredits([{title:"Example",url:"javascript:alert(1)",author:"Author",license:"CC0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/"}])).toEqual([]);
  });
  it("accepts dental classification but rejects an unsupported capture protocol", () => {
    const treatment={name:"Alignment",category:"Dental",bodyArea:"Teeth",description:"",startDate:"",status:"active",procedureType:"Orthodontics",productName:"",protocolCode:"DENTAL_STANDARD"};
    expect(treatmentSchema.safeParse(treatment).success).toBe(true);
    expect(treatmentSchema.safeParse({...treatment,protocolCode:"FORGED"}).success).toBe(false);
  });
});
