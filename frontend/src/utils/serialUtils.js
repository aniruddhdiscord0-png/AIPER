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
