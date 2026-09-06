export const steps = [
  {
    title: "Lease & household",
    eyebrow: "Step 1 of 6",
    description: "Start with the unit, lease dates, and everyone who will live there.",
    fields: [
      ["unitAddress", "Address of unit being leased", "address", true],
      ["occupancyDate", "Date of occupancy", "date", true],
      ["leaseStart", "Lease starting date", "date", true],
      ["leaseEnd", "Lease ending date", "date", true],
      ["peopleCount", "Number of occupants", "number", true],
      ["ownerName", "Current unit owner", "text", true],
      ["realtor", "Realtor name and phone", "text"],
      ["applicantName", "Applicant full legal name", "text", true],
      ["applicantDob", "Applicant date of birth", "date", true],
      ["applicantDl", "Applicant driver’s license / state ID number", "text", true],
      ["applicantPhone", "Applicant phone", "tel", true],
      ["applicantEmail", "Applicant email", "email", true],
      ["spouseName", "Spouse / co-applicant full legal name", "text"],
      ["spouseDob", "Spouse / co-applicant date of birth", "date"],
      ["spouseDl", "Spouse / co-applicant license / ID number", "text"],
      ["spousePhone", "Spouse / co-applicant phone", "tel"],
      ["spouseEmail", "Spouse / co-applicant email", "email"],
      ["occupant1", "Other occupant 1: name, relationship, age", "text"],
      ["occupant2", "Other occupant 2: name, relationship, age", "text"]
    ]
  },
  {
    title: "Safety, pets & disclosures",
    eyebrow: "Step 2 of 6",
    description: "These answers transfer to page 3 of the official packet.",
    fields: [
      ["emergency1", "Emergency contact 1: name, phone, address", "textarea", true],
      ["emergency2", "Emergency contact 2: name, phone, address", "textarea"],
      ["hasPets", "Do you have pets?", "select", true, ["No", "Yes"]],
      ["petDetails", "Pet name, type / breed, and adult weight", "textarea"],
      ["waterbed", "Do you own a water bed?", "select", true, ["No", "Yes"]],
      ["smokes", "Do you smoke?", "select", true, ["No", "Yes"]],
      ["ownsRealEstate", "Do you own real estate?", "select", true, ["No", "Yes"]],
      ["realEstateWhere", "If yes, where?", "textarea"],
      ["evicted", "Ever evicted from rental premises?", "select", true, ["No", "Yes"]],
      ["evictedExplain", "If yes, explain", "textarea"],
      ["refusedRent", "Ever willfully and intentionally refused rent when due?", "select", true, ["No", "Yes"]],
      ["refusedRentExplain", "If yes, explain", "textarea"],
      ["felony", "Ever convicted of a felony?", "select", true, ["No", "Yes"]],
      ["felonyExplain", "If yes, explain", "textarea"]
    ]
  },
  {
    title: "Contacts & references",
    eyebrow: "Step 3 of 6",
    description: "The packet asks for two work references and two personal references in addition to two recommendation letters.",
    fields: [
      ["vehicle1", "Vehicle 1: type, color, plate", "text"],
      ["vehicle2", "Vehicle 2: type, color, plate", "text"],
      ["nearestRelative", "Nearest relative not living with you: name, address, relationship, phone", "textarea", true],
      ["workRef1", "Work reference 1: name, title, address, phone", "textarea", true],
      ["workRef2", "Work reference 2: name, title, address, phone", "textarea", true],
      ["personalRef1", "Personal reference 1: name, address, relationship, phone", "textarea", true],
      ["personalRef2", "Personal reference 2: name, address, relationship, phone", "textarea", true]
    ]
  },
  {
    title: "Residence history",
    eyebrow: "Step 4 of 6",
    description: "Provide at least five years. Add the dates directly into each entry.",
    fields: [
      ["currentStreet", "Current street address", "address", true],
      ["currentCityStateZip", "Current city, state, ZIP", "text", true],
      ["currentPhone", "Current residence phone", "tel", true],
      ["currentDates", "Current dates of residency", "text", true],
      ["currentLandlord", "Current landlord: name, address, phone", "textarea"],
      ["priorStreet", "Prior street address", "address", true],
      ["priorCityStateZip", "Prior city, state, ZIP", "text", true],
      ["priorDates", "Prior dates of residency", "text", true],
      ["priorLandlord", "Prior landlord: name, address, phone", "textarea"]
    ]
  },
  {
    title: "Employment & bank",
    eyebrow: "Step 5 of 6",
    description: "Retired applicants can enter the organization they retired from. The HOA may later request pay stubs and a W-2.",
    fields: [
      ["employmentStatus", "Applicant employment status", "select", true, ["Employed", "Retired", "Not currently employed"]],
      ["employer", "Employer / retired from: name, address, phone, length, monthly salary", "textarea", true],
      ["spouseEmploymentStatus", "Spouse / co-applicant employment status", "select", false, ["Employed", "Retired", "Not currently employed", "Not applicable"]],
      ["spouseEmployer", "Spouse employer / retired from: name, address, phone, length, monthly salary", "textarea"],
      ["priorEmployer", "Prior employer if current employment is under 5 years: name, length, address, phone", "textarea"],
      ["spousePriorEmployer", "Spouse prior employer if needed", "textarea"],
      ["bankReference", "Bank reference: institution, phone, address, length of relationship", "textarea", true]
    ]
  },
  {
    title: "Authorize & export",
    eyebrow: "Step 6 of 6",
    description: "Sensitive details stay in this browser tab. They are placed into the PDF only when you download it.",
    fields: [
      ["applicantSsn", "Applicant Social Security number", "password", true],
      ["spouseSsn", "Spouse / co-applicant Social Security number", "password"],
      ["initials", "Applicant initials for all 13 pages", "text", true],
      ["signedDate", "Date signed", "date", true]
    ]
  }
];

export const requirements = [
  "Completed 13-page application with every blank answered or marked N/A",
  "Applicant initials on every page",
  "Authorization signed by each adult applicant",
  "Rules acknowledgment signed on pages 7 and 13",
  "Clear driver’s license or photo ID copy for every applicant over 18",
  "Copy of the signed lease agreement",
  "$150 nonrefundable processing fee payable to Alliant Property Management",
  "$66 per person credit and national criminal background fee payable to Alliant Property Management",
  "Two letters of recommendation",
  "Board approval before move-in; allow 30 days after a complete submission"
];
