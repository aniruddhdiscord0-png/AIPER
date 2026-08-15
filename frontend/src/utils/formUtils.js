export const BLANK_FORM = {
  // Customer
  customer_name: "",
  customer_address: "",
  contact_person: "",
  mobile_number: "",
  email: "",
  customer_reference_no: "",
  batch_no: "",
  dom: "",
  brand_name: "",
  any_other_info: "",
  batch_size: "",
  doe: "",
  // Sample
  sample_name: "",
  sample_id: "",
  sample_quantity: "",
  sample_quantity_unit: "ml",
  sample_count: 1,

  condition_on_receipt: "",
  packing_details: "",
  marking_seal: "",
  sample_source: "",
  received_date_dd: "",
  received_date_mm: "",
  received_date_yyyy: "",
  received_mode: "Select",
  nabl_mode: "non_nabl",
  // Compliance
  statement_of_conformity: "",
  decision_rule: "",
  accreditation_scope: "",
  disclaimer_notes: "",
  special_handling_instructions: "",
};

// Helper: same format as backend buildJobCode — YYMMDD + 4-digit padded serial
// Accepts an optional YYYY-MM-DD date string to override the date prefix.
