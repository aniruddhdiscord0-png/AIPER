export const formatJobCode = (code) => {
  if (!code) return "";
  const parts = code.split("-");
  if (parts.length < 3) return code;

  // Expected format: YYYYMMDD-D-XXXX-?
  const datePart = parts[0];
  const deptPart = parts[1];
  const serialPart = parts[2];
  const retestPart = parts.length > 3 ? `-${parts.slice(3).join("-")}` : "";

  return `${datePart}-${deptPart}-${serialPart}${retestPart}`;
};

export const validateJobCode = (val) => {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3 || parts[0].length !== 8 || (parts[1] !== "M" && parts[1] !== "C") || parts[2].length !== 4) {
    return "Format must be YYYYMMDD-M-XXXX or YYYYMMDD-C-XXXX";
  }
  return "";
};
