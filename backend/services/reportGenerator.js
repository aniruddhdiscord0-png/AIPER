const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, WidthType, BorderStyle, AlignmentType, VerticalAlign, PageBreak, Header, Footer, SectionType, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../assets/acropolis-logo.png');
const nablLogoPath = path.join(__dirname, '../assets/nabl-logo.png');
const nablQrcodePath = path.join(__dirname, '../assets/nabl-qrcode.png');

// --- Height estimation for dynamic pagination (all values in twips) ---
const PAGE_HEIGHT_DXA = 15840;
const MARGIN_TOP = 720;
const MARGIN_BOTTOM = 720;
const FOOTER_RESERVE = 400; // space for page number footer
const USABLE_HEIGHT = PAGE_HEIGHT_DXA - MARGIN_TOP - MARGIN_BOTTOM - FOOTER_RESERVE;

// Safety multiplier: keep at 1.0 (no inflation) since PDF renders correctly;
// Word Online/docx-preview differences are cosmetic only
const SAFETY_FACTOR = 1.0;

// Approximate character width in twips for Times New Roman at size 20 (10pt)
const AVG_CHAR_WIDTH = 100;
const LINE_HEIGHT = 260;     // single line height in twips
const ROW_PADDING = 50;      // top+bottom cell margins per row

// Estimate how many lines a text will need in a column of given width
const estimateLines = (text, colWidthDxa) => {
  if (!text) return 1;
  const charsPerLine = Math.max(1, Math.floor(colWidthDxa / AVG_CHAR_WIDTH));
  let total = 0;
  for (const line of String(text).split('\n')) {
    total += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return total;
};

// Estimate height of a result row based on its longest cell (with safety margin)
const estimateResultRowHeight = (row, hasSpec) => {
  let baseHeight;
  if (row.type === 'header') {
    // Discipline header: 2 lines of text typically
    baseHeight = 2 * LINE_HEIGHT + ROW_PADDING;
  } else {
    // Data row — the "Test Parameters" column (35% width) is usually the tallest
    const paramColWidth = Math.round(PAGE_WIDTH_DXA * 35 / 100);
    const nameLines = estimateLines(row.data.name, paramColWidth);
    baseHeight = nameLines * LINE_HEIGHT + ROW_PADDING;
  }
  return Math.ceil(baseHeight * SAFETY_FACTOR);
};

// Fixed height estimates for non-result content (all include safety margin)
const HEADER_HEIGHT = Math.ceil(1600 * SAFETY_FACTOR);
const FTL_REF_HEIGHT = Math.ceil(340 * SAFETY_FACTOR);
const TEST_REPORT_TITLE = Math.ceil(360 * SAFETY_FACTOR);
const REPORT_ULR_LINE = Math.ceil(280 * SAFETY_FACTOR);
const TEST_RESULT_TITLE = Math.ceil(400 * SAFETY_FACTOR);
const RESULTS_HEADER_ROW = Math.ceil(320 * SAFETY_FACTOR);

// Footer block (abbreviations + notes + signing spacer + signatures + end of report)
const FOOTER_BLOCK_HEIGHT = Math.ceil(3200 * SAFETY_FACTOR);

// Height of a discipline header row (for injection on continuation pages)
const DISCIPLINE_HEADER_HEIGHT = Math.ceil((2 * LINE_HEIGHT + ROW_PADDING) * SAFETY_FACTOR);

// Estimate sample info table height based on content
const estimateSampleInfoHeight = (job) => {
  const sample = job.sample || {};
  const customer = job.customer || {};
  // Customer info row (3 lines: name, address, contact)
  let height = 3 * LINE_HEIGHT + ROW_PADDING;
  // 11 fixed rows + Sample Description row
  height += 11 * (LINE_HEIGHT + ROW_PADDING);
  // Sample Description might be multi-line
  const descLines = estimateLines(sample.sample_description, Math.round(PAGE_WIDTH_DXA * 80 / 100));
  height += descLines * LINE_HEIGHT + ROW_PADDING;
  // Sampling details might wrap
  const samplingLines = estimateLines(sample.sampling_details, Math.round(PAGE_WIDTH_DXA * 20 / 100));
  if (samplingLines > 1) height += (samplingLines - 1) * LINE_HEIGHT;
  return Math.ceil(height * SAFETY_FACTOR);
};

// First page overhead (everything before results)
const calcFirstPageOverhead = (job) => {
  return FTL_REF_HEIGHT + HEADER_HEIGHT + TEST_REPORT_TITLE + REPORT_ULR_LINE + estimateSampleInfoHeight(job) + TEST_RESULT_TITLE + RESULTS_HEADER_ROW;
};

// Continuation page overhead (header + TEST REPORT + Report/ULR + mini sample info + column headers)
// NOTE: TEST RESULT title only appears on the first page
const calcContinuationOverhead = () => {
  const CONT_SAMPLE_INFO = Math.ceil((LINE_HEIGHT + ROW_PADDING) * SAFETY_FACTOR);
  return FTL_REF_HEIGHT + HEADER_HEIGHT + TEST_REPORT_TITLE + REPORT_ULR_LINE + CONT_SAMPLE_INFO + RESULTS_HEADER_ROW;
};

const BORDERS_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

// Table-level borders (includes inside borders)
const TABLE_BORDERS_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

const BORDERS_ALL = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const PAGE_WIDTH_DXA = 10800;

const createCell = (text, options = {}) => {
  const { bold = false, alignment = AlignmentType.LEFT, colSpan = 1, rowSpan = 1, borders = BORDERS_ALL, shading = null, size = 20, verticalAlign = VerticalAlign.CENTER, widthPct } = options;
  const textString = text || "";
  const lines = textString.split('\n');
  const children = lines.map(line =>
    new Paragraph({
      children: [new TextRun({ text: line, bold, font: "Times New Roman", size })],
      alignment,
      spacing: { line: 240, before: 0, after: 0 }
    })
  );
  const cellOptions = {
    children, columnSpan: colSpan, rowSpan, borders, verticalAlign,
    margins: { top: 20, bottom: 20, left: 40, right: 40 }
  };
  if (widthPct) cellOptions.width = { size: Math.round(PAGE_WIDTH_DXA * widthPct / 100), type: WidthType.DXA };
  if (shading) cellOptions.shading = { fill: shading };
  return new TableCell(cellOptions);
};

const createImageCell = (imageBuffer, width, height, borders = BORDERS_ALL, alignment = AlignmentType.CENTER, widthPct = null) => {
  if (!imageBuffer) return new TableCell({ children: [new Paragraph({ children: [] })], borders });
  const cellOpts = {
    children: [new Paragraph({ children: [new ImageRun({ data: imageBuffer, transformation: { width, height }, type: "png" })], alignment })],
    borders, verticalAlign: VerticalAlign.CENTER
  };
  if (widthPct) cellOpts.width = { size: Math.round(PAGE_WIDTH_DXA * widthPct / 100), type: WidthType.DXA };
  return new TableCell(cellOpts);
};

const deriveReportFields = (jobCode) => {
  // Extract the base numeric code (first 10 digits), ignoring suffixes like -N, -retest-1
  const baseCode = jobCode ? jobCode.match(/^(\d+)/)?.[1] || '' : '';
  const last4 = baseCode ? baseCode.slice(-4) : '0000';
  const yy = baseCode ? baseCode.slice(0, 2) : '00';

  // Detect Non-NABL suffix (-N)
  const isNonNabl = jobCode ? /^[\d]+-N(?:-|$)/.test(jobCode) || jobCode.endsWith('-N') : false;
  const nonNablSuffix = isNonNabl ? '-N' : '';

  // Detect retest suffix (-retest-1 → A, -retest-2 → B, etc.)
  const retestMatch = jobCode ? jobCode.match(/retest-(\d+)/i) : null;
  let retestLetter = '';
  if (retestMatch && retestMatch[1]) {
    retestLetter = String.fromCharCode(64 + parseInt(retestMatch[1], 10));
  }

  const baseReportNo = `FTL/AIPER/${yy}/${last4}`;
  const testReportNo = `${baseReportNo}${nonNablSuffix}${retestLetter ? '-' + retestLetter : ''}`;
  const registrationNo = String(Math.max(0, parseInt(last4, 10) - 1099));
  return { testReportNo, registrationNo, isAmended: !!retestLetter, baseReportNo };
};

// --- Page Builders ---
const buildHeaderTable = (isNabl) => {
  const logoBuf = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
  const nablLogoBuf = fs.existsSync(nablLogoPath) ? fs.readFileSync(nablLogoPath) : null;
  const nablQrcodeBuf = fs.existsSync(nablQrcodePath) ? fs.readFileSync(nablQrcodePath) : null;

  // Compact line spacing: slightly increased for better breathing room (280 twips + 30 twips margins)
  const LS = { before: 30, after: 30, line: 280 };

  // --- Cell 1: Acropolis logo (fixed 20%) ---
  const logoCell = createImageCell(logoBuf, 130, 75, BORDERS_ALL, AlignmentType.CENTER, 20);

  // --- Cell 2: Text block ---
  // Compact: merge phone lines, merge email+website onto one line
  const textCellWidth = isNabl ? 55 : 80;
  const textCell = new TableCell({
    children: [
      new Paragraph({ children: [new TextRun({ text: "Food Testing Laboratory", bold: true, font: "Times New Roman", size: 26 })], alignment: AlignmentType.CENTER, spacing: LS }),
      new Paragraph({ children: [new TextRun({ text: "Acropolis Institute of Pharmaceutical Education and Research", font: "Times New Roman", size: 16 })], alignment: AlignmentType.CENTER, spacing: LS }),
      new Paragraph({ children: [new TextRun({ text: "Mangliya Square, Indore Bypass Road, Indore M.P.-453771", font: "Times New Roman", size: 16 })], alignment: AlignmentType.CENTER, spacing: LS }),
      new Paragraph({ children: [new TextRun({ text: "Mobile: +91 9201974674; Landline: 731-4730174, 175,176 & 184", font: "Times New Roman", size: 16 })], alignment: AlignmentType.CENTER, spacing: LS }),
      new Paragraph({ children: [
        new TextRun({ text: "Email ID:ftl@acropolis.edu.in", font: "Times New Roman", size: 16, color: "0000FF" }),
        new TextRun({ text: "  |  ", font: "Times New Roman", size: 16 }),
        new TextRun({ text: "Website: www.acrolabs.in", font: "Times New Roman", size: 16, color: "0000FF" })
      ], alignment: AlignmentType.CENTER, spacing: LS })
    ],
    verticalAlign: VerticalAlign.CENTER, borders: BORDERS_ALL,
    width: { size: Math.round(PAGE_WIDTH_DXA * textCellWidth / 100), type: WidthType.DXA }
  });

  const cells = [logoCell, textCell];

  // --- Cell 3 (NABL only): Single cell with NABL logo + QR side-by-side ---
  if (isNabl) {
    const nablChildren = [];

    // Both images INLINE in one paragraph — forces them side-by-side, never stacks
    const inlineImages = [];
    if (nablLogoBuf) {
      inlineImages.push(new ImageRun({ data: nablLogoBuf, transformation: { width: 65, height: 65 }, type: "png" }));
    }
    // Add spacing between the two images
    inlineImages.push(new TextRun({ text: "    ", font: "Times New Roman", size: 16 }));
    if (nablQrcodeBuf) {
      inlineImages.push(new ImageRun({ data: nablQrcodeBuf, transformation: { width: 65, height: 65 }, type: "png" }));
    }
    nablChildren.push(new Paragraph({
      children: inlineImages,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 }
    }));

    // TC-12434 centered in the left half of the cell (under NABL logo)
    // Right indent shrinks the centering zone to align with the left image
    nablChildren.push(new Paragraph({
      children: [new TextRun({ text: "TC-12434", bold: true, font: "Times New Roman", size: 14 })],
      alignment: AlignmentType.CENTER,
      indent: { right: 1100 },
      spacing: { before: 20, after: 0 }
    }));

    cells.push(new TableCell({
      children: nablChildren,
      verticalAlign: VerticalAlign.CENTER,
      borders: BORDERS_ALL,
      width: { size: Math.round(PAGE_WIDTH_DXA * 25 / 100), type: WidthType.DXA }
    }));
  }

  return new Table({ rows: [new TableRow({ children: cells })], width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA } });
};

const buildSampleInfoTable = (job) => {
  const customer = job.customer || {};
  const sample = job.sample || {};
  const compliance = job.compliance || {};
  const { testReportNo, registrationNo } = deriveReportFields(job.jobCode);
  const fallbackDate = sample.received_date || job.createdAt;
  const completedAt = job.completedAt || fallbackDate;
  const issueDate = new Date(completedAt).toLocaleDateString('en-IN');
  const receiptDate = new Date(fallbackDate).toLocaleDateString('en-IN');
  const tp = job.testingPeriod || {};
  const testingPeriodStr = tp.startDate && tp.endDate
    ? `${new Date(tp.startDate).toLocaleDateString('en-IN')} to ${new Date(tp.endDate).toLocaleDateString('en-IN')}`
    : 'N/A';

  const contactDetailsArr = [];
  if (customer.contact_person) contactDetailsArr.push(customer.contact_person);
  if (customer.mobile_number) contactDetailsArr.push(customer.mobile_number);
  if (customer.email) contactDetailsArr.push(customer.email);
  const contactDetailsStr = contactDetailsArr.length > 0 ? contactDetailsArr.join(' ') : 'N/A';

  const r = [];

  // Customer info row
  r.push(new TableRow({
    children: [new TableCell({
      children: [
        new Paragraph({ children: [new TextRun({ text: "Customer Name :  ", bold: true, font: "Times New Roman", size: 20 }), new TextRun({ text: customer.customer_name || job.clientName || 'N/A', font: "Times New Roman", size: 20 })], spacing: { before: 0, after: 0 } }),
        new Paragraph({ children: [new TextRun({ text: "Address :               ", bold: true, font: "Times New Roman", size: 20 }), new TextRun({ text: customer.customer_address || 'N/A', font: "Times New Roman", size: 20 })], spacing: { before: 0, after: 0 } }),
        new Paragraph({ children: [new TextRun({ text: "Contact details:   ", bold: true, font: "Times New Roman", size: 20 }), new TextRun({ text: contactDetailsStr, font: "Times New Roman", size: 20 })], spacing: { before: 0, after: 0 } })
      ], columnSpan: 5, borders: BORDERS_ALL, margins: { top: 20, bottom: 20, left: 40, right: 40 }
    })]
  }));

  r.push(new TableRow({ children: [createCell("Sample Name\n( as stated by customer )", { bold: true, colSpan: 2, widthPct: 25 }), createCell(sample.sample_name || 'N/A', { widthPct: 30 }), createCell("Registration No.", { bold: true, widthPct: 23 }), createCell(registrationNo, { widthPct: 22 })] }));
  r.push(new TableRow({ children: [createCell("Product Category", { bold: true, colSpan: 2, widthPct: 25 }), createCell(job.groupMetadata?.productCategory || 'N/A', { widthPct: 30 }), createCell("Issue Date", { bold: true, widthPct: 23 }), createCell(issueDate, { widthPct: 22 })] }));
  r.push(new TableRow({ children: [createCell("Sample Quantity", { bold: true, colSpan: 2, widthPct: 25 }), createCell(`01x${sample.sample_quantity || 'N/A'}`, { widthPct: 30 }), createCell("Date of Receipt", { bold: true, widthPct: 23 }), createCell(receiptDate, { widthPct: 22 })] }));
  r.push(new TableRow({ children: [createCell("Packing Details", { bold: true, colSpan: 2, widthPct: 25 }), createCell(sample.packing_details || 'N/A', { widthPct: 30 }), createCell("Testing period", { bold: true, widthPct: 23 }), createCell(testingPeriodStr, { widthPct: 22 })] }));
  r.push(new TableRow({ children: [createCell("Marking Seal ( if any)", { bold: true, colSpan: 2, widthPct: 25 }), createCell(sample.marking_seal || 'NA', { widthPct: 30 }), createCell("Standard Specification", { bold: true, widthPct: 23 }), createCell(compliance.standard_specification || 'NA', { widthPct: 22 })] }));
  r.push(new TableRow({ children: [createCell("Sampling Details", { bold: true, colSpan: 2, widthPct: 25 }), createCell(sample.sampling_details || 'Sample provided by the customer', { widthPct: 30 }), createCell("Sample condition on receipt", { bold: true, widthPct: 23 }), createCell(sample.condition_on_receipt || 'Satisfactory', { widthPct: 22 })] }));
  const hasCustomerData = !!(
    customer.customer_reference_no ||
    customer.batch_no ||
    customer.dom ||
    customer.brand_name ||
    customer.any_other_info ||
    customer.batch_size ||
    customer.doe
  );

  if (hasCustomerData) {
    r.push(new TableRow({ children: [createCell("Any data provided by customer;", { bold: true, colSpan: 5 })] }));
    r.push(new TableRow({ children: [createCell("Customer ref.", { bold: true, colSpan: 2, widthPct: 25 }), createCell(customer.customer_reference_no || 'NA', { widthPct: 30 }), createCell("Brand Name", { bold: true, widthPct: 23 }), createCell(customer.brand_name || 'NA', { widthPct: 22 })] }));
    r.push(new TableRow({ children: [createCell("Batch No.", { bold: true, colSpan: 2, widthPct: 25 }), createCell(customer.batch_no || 'NA', { widthPct: 30 }), createCell("Any Other Information", { bold: true, widthPct: 23 }), createCell(customer.any_other_info || 'NA', { widthPct: 22 })] }));
    r.push(new TableRow({ children: [createCell("DOM", { bold: true, colSpan: 2, widthPct: 25 }), createCell(customer.dom || 'NA', { widthPct: 30 }), createCell("Batch Size", { bold: true, widthPct: 23 }), createCell(customer.batch_size || 'NA', { widthPct: 22 })] }));
    r.push(new TableRow({ children: [createCell("Any Handling Instructions provided : Yes/NO ( if yes ; Short details)", { bold: true, colSpan: 3, widthPct: 55 }), createCell("DOE", { bold: true, widthPct: 23 }), createCell(customer.doe || 'NA', { widthPct: 22 })] }));
  } else {
    r.push(new TableRow({ children: [createCell("Any Handling Instructions provided : Yes/NO ( if yes ; Short details)", { bold: true, colSpan: 5 })] }));
  }
  r.push(new TableRow({ children: [createCell("Sample Description", { bold: true }), createCell(sample.sample_description || 'N/A', { colSpan: 4 })] }));

  return new Table({ rows: r, width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA } });
};

const buildResultsTable = (rowsData, hasSpec, startIdx, repeatHeader = null) => {
  const tableRows = [];
  let counter = startIdx;

  const headerCells = [
    createCell("Sr. No.", { bold: true, alignment: AlignmentType.CENTER, widthPct: 8 }),
    createCell("Test Parameters", { bold: true, widthPct: 35 }),
    createCell("UoM", { bold: true, alignment: AlignmentType.CENTER, widthPct: 12 }),
    createCell("Result", { bold: true, alignment: AlignmentType.CENTER, widthPct: 15 }),
    createCell("Test Method", { bold: true, alignment: AlignmentType.CENTER, widthPct: hasSpec ? 15 : 30 })
  ];
  if (hasSpec) headerCells.push(createCell("Specification", { bold: true, alignment: AlignmentType.CENTER, widthPct: 15 }));
  tableRows.push(new TableRow({ children: headerCells }));

  // Inject repeat discipline header for continuation pages
  if (repeatHeader) {
    tableRows.push(new TableRow({
      children: [
        createCell(`Discipline- ${repeatHeader.dept === 'CHEMICAL' ? 'Chemical' : 'Biological'}\n${repeatHeader.dept === 'CHEMICAL' ? 'Chemical Test Parameter' : 'Microbiology Test Parameters'}`, { bold: true, colSpan: 3 }),
        createCell(`Group \u2013 ${repeatHeader.group}\nSub Group \u2013 ${repeatHeader.subGroup}`, { bold: true, colSpan: hasSpec ? 3 : 2 })
      ]
    }));
  }

  for (const r of rowsData) {
    if (r.type === 'header') {
      tableRows.push(new TableRow({
        children: [
          createCell(`Discipline- ${r.dept === 'CHEMICAL' ? 'Chemical' : 'Biological'}\n${r.dept === 'CHEMICAL' ? 'Chemical Test Parameter' : 'Microbiology Test Parameters'}`, { bold: true, colSpan: 3 }),
          createCell(`Group \u2013 ${r.group}\nSub Group \u2013 ${r.subGroup}`, { bold: true, colSpan: hasSpec ? 3 : 2 })
        ]
      }));
    } else {
      counter++;
      const dataCells = [
        createCell(`${counter}.`, { alignment: AlignmentType.CENTER }),
        createCell(r.data.name),
        createCell(r.data.unit || '--', { alignment: AlignmentType.CENTER }),
        createCell(r.data.value || '--', { bold: false, alignment: AlignmentType.CENTER }),
        createCell(r.data.testMethod || '--', { alignment: AlignmentType.CENTER })
      ];
      if (hasSpec) dataCells.push(createCell(r.data.specification || '--', { alignment: AlignmentType.CENTER }));
      tableRows.push(new TableRow({ children: dataCells }));
    }
  }

  if (rowsData.length === 0) {
    tableRows.push(new TableRow({ children: [createCell("No results recorded.", { colSpan: hasSpec ? 6 : 5, alignment: AlignmentType.CENTER })] }));
  }

  return new Table({ rows: tableRows, width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA } });
};

const generateReport = async (job, reportType) => {
  const isNabl = reportType === 'nabl';
  const { testReportNo, registrationNo, isAmended, baseReportNo } = deriveReportFields(job.jobCode);

  const allRows = [];
  const groupName = job.groupMetadata?.group || 'N/A';
  const subGroupName = job.groupMetadata?.subGroup || 'N/A';
  const parameters = job.parameters || [];

  const chemicalResults = parameters.filter(p => (p.type || '').toUpperCase() === 'CHEMICAL');
  const microResults = parameters.filter(p => (p.type || '').toUpperCase() === 'MICRO');

  if (chemicalResults.length > 0) {
    allRows.push({ type: 'header', dept: 'CHEMICAL', group: groupName, subGroup: subGroupName });
    chemicalResults.forEach(r => allRows.push({ type: 'result', data: r }));
  }
  if (microResults.length > 0) {
    allRows.push({ type: 'header', dept: 'MICRO', group: groupName, subGroup: subGroupName });
    microResults.forEach(r => allRows.push({ type: 'result', data: r }));
  }

  const hasSpec = !!job.showSpecifications;

  // --- Dynamic pagination via height estimation ---
  // Track the "active discipline" so we can inject a repeat header on continuation pages
  const pages = [];
  let idx = 0;
  let currentResultIndex = 0;
  let activeDiscipline = null; // tracks the last discipline header we passed

  while (idx < allRows.length || pages.length === 0) {
    const isFirstPage = pages.length === 0;
    const overhead = isFirstPage ? calcFirstPageOverhead(job) : calcContinuationOverhead();
    let usedHeight = overhead;
    const pageRows = [];

    // If this is a continuation page and we're mid-discipline, inject a repeat header
    let needsDisciplineRepeat = !isFirstPage && activeDiscipline !== null;
    if (needsDisciplineRepeat) {
      // Reserve space for the injected discipline header
      usedHeight += DISCIPLINE_HEADER_HEIGHT;
    }

    while (idx < allRows.length) {
      const row = allRows[idx];
      const rowHeight = estimateResultRowHeight(row, hasSpec);

      // Track discipline context
      if (row.type === 'header') {
        activeDiscipline = row;
      }

      // Simple footer check: only reserve footer space when adding the last row
      const isLastRow = idx === allRows.length - 1;
      const footerHeight = isLastRow ? FOOTER_BLOCK_HEIGHT : 0;

      if (usedHeight + rowHeight + footerHeight > USABLE_HEIGHT && pageRows.length > 0) {
        break; // doesn't fit, start new page
      }

      pageRows.push(row);
      usedHeight += rowHeight;
      idx++;

      // After adding a discipline header, cancel the repeat flag since we just added one
      if (row.type === 'header') {
        needsDisciplineRepeat = false;
      }
    }

    // Determine the discipline context for this page (for repeat header injection)
    let repeatHeader = null;
    if (!isFirstPage && needsDisciplineRepeat && activeDiscipline) {
      // The page starts mid-discipline — inject a repeat header
      repeatHeader = activeDiscipline;
    }

    pages.push({ rows: pageRows, startIdx: currentResultIndex, repeatHeader });
    currentResultIndex += pageRows.filter(r => r.type === 'result').length;

    if (pageRows.length === 0 && idx >= allRows.length) break; // safety
  }

  const sections = [];

  for (let i = 0; i < pages.length; i++) {
    const isFirst = i === 0;
    const isLast = i === pages.length - 1;
    const pageObj = pages[i];
    const children = [];

    // FTL reference
    children.push(new Paragraph({
      children: [new TextRun({ text: "FTL/AIPER/F/7.8-01", bold: true, font: "Times New Roman", size: 16 })],
      alignment: AlignmentType.RIGHT, spacing: { after: 100 }
    }));

    // Sticky Header
    children.push(buildHeaderTable(isNabl));

    // TEST REPORT title
    children.push(new Paragraph({
      children: [new TextRun({ text: "TEST REPORT", bold: true, font: "Times New Roman", size: 28 })],
      alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }
    }));

    // Report No + ULR No on same line (single paragraph with tab stop)
    const reportUlrRuns = [
      new TextRun({ text: "Report  No. ", bold: true, font: "Times New Roman", size: 20 }),
      new TextRun({ text: testReportNo, font: "Times New Roman", size: 20 })
    ];
    if (isNabl && job.sample?.ulr_no) {
      reportUlrRuns.push(new TextRun({ text: "\t", font: "Times New Roman", size: 20 }));
      reportUlrRuns.push(new TextRun({ text: "ULR No. ", bold: true, font: "Times New Roman", size: 20 }));
      reportUlrRuns.push(new TextRun({ text: job.sample.ulr_no, font: "Times New Roman", size: 20 }));
    }
    children.push(new Paragraph({
      children: reportUlrRuns,
      tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH_DXA }],
      spacing: { before: 40, after: 40 }
    }));

    if (isFirst) {
      children.push(buildSampleInfoTable(job));
    } else {
      // Continuation: Sample Name + Registration No only
      children.push(new Table({
        rows: [new TableRow({
          children: [
            createCell("Sample Name\n( as stated by customer )", { bold: true, widthPct: 30 }),
            createCell(job.sample?.sample_name || 'N/A', { widthPct: 20 }),
            createCell("Registration No.", { bold: true, widthPct: 25 }),
            createCell(registrationNo, { widthPct: 25 })
          ]
        })],
        width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }
      }));
    }

    // TEST RESULT title — only on the first page
    if (isFirst) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "TEST RESULT", bold: true, font: "Times New Roman", size: 24 })],
        alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }
      }));
    } else {
      // Small spacer to separate repeating header from results table
      children.push(new Paragraph({ children: [], spacing: { before: 100, after: 60 } }));
    }

    children.push(buildResultsTable(pageObj.rows, hasSpec, pageObj.startIdx, pageObj.repeatHeader));

    if (isLast) {
      // Abbreviations - updated to match final format
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Abbreviations used: ", bold: true, font: "Times New Roman", size: 18 }),
          new TextRun({ text: "UOM: Unit of Measurement; BLQ-Below limit of Quantification, LOQ:-Limit of Quantification", font: "Times New Roman", size: 18 })
        ],
        spacing: { before: 60 }, alignment: AlignmentType.LEFT
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: "DOE: Date of Expiry; DOM: Date of Manufacturing; NA: Not Applicable.NMT: Not More Than , NLT: Not Less Than", font: "Times New Roman", size: 18 })],
        alignment: AlignmentType.LEFT
      }));

      const noteRuns = [
        new TextRun({ text: "NOTE: ", bold: true, font: "Times New Roman", size: 18 }),
        new TextRun({ text: "1) Report shall not be reproduced except in full without approval of the laboratory.", font: "Times New Roman", size: 18 }),
        new TextRun({ text: "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A02) The results relate only to the items as received.", break: 1, font: "Times New Roman", size: 18 }),
        new TextRun({ text: "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A03) Duplicate report will be issued on chargeable basis.", break: 1, font: "Times New Roman", size: 18 })
      ];
      if (isAmended) {
        noteRuns.push(new TextRun({ text: `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A04) This test report is the replacement to earlier test report no. (${baseReportNo}). Earlier test report stands obsolete.`, break: 1, font: "Times New Roman", size: 18 }));
      }
      children.push(new Paragraph({ children: noteRuns, alignment: AlignmentType.LEFT }));

      // Dynamic signatures based on involved departments
      const hasChem = chemicalResults.length > 0;
      const hasMicro = microResults.length > 0;
      const sigCells = [];

      // Diksha always appears
      sigCells.push(new TableCell({
        children: [
          new Paragraph({ children: [new TextRun({ text: "Reviewed By", bold: true, font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: "Ms. Diksha Dwivedi", font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: "Analyst", font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER })
        ], borders: BORDERS_NONE, width: { size: Math.round(PAGE_WIDTH_DXA / (hasChem && hasMicro ? 3 : 2)), type: WidthType.DXA }
      }));

      if (hasChem) {
        sigCells.push(new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: "Authorized Signatory", bold: true, font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: job.distribution?.chemical?.assignedHead?.name || 'Ms. Monika Pali', font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Technical Manager", font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER })
          ], borders: BORDERS_NONE, width: { size: Math.round(PAGE_WIDTH_DXA / (hasChem && hasMicro ? 3 : 2)), type: WidthType.DXA }
        }));
      }

      if (hasMicro) {
        sigCells.push(new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: "Authorized Signatory", bold: true, font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: job.distribution?.micro?.assignedHead?.name || 'Ms. Jyoti Pathak', font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Microbiology Head", font: "Times New Roman", size: 20 })], alignment: AlignmentType.CENTER })
          ], borders: BORDERS_NONE, width: { size: Math.round(PAGE_WIDTH_DXA / (hasChem && hasMicro ? 3 : 2)), type: WidthType.DXA }
        }));
      }

      // Spacer for physical signing space
      children.push(new Paragraph({ children: [], spacing: { before: 600 } }));
      children.push(new Table({ rows: [new TableRow({ children: sigCells })], width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA }, borders: TABLE_BORDERS_NONE }));

      children.push(new Paragraph({
        children: [new TextRun({ text: "*End of report*", bold: true, font: "Times New Roman", size: 22 })],
        alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 }
      }));
    }

    // No explicit PageBreak needed — each page is its own section, which
    // automatically starts on a new page. Adding PageBreak here would
    // create a blank page between sections.

    sections.push({
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 }, size: { width: 12240, height: 15840 } } },
      headers: { default: new Header({ children: [] }) },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({ children: [new TextRun({ text: `Page ${i + 1} of ${pages.length}`, font: "Times New Roman", size: 20 })], alignment: AlignmentType.RIGHT })
          ]
        })
      },
      children
    });
  }

  const doc = new Document({ sections });
  return await Packer.toBuffer(doc);
};

module.exports = { generateReport };
