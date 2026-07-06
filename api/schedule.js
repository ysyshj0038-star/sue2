const SHEET_ID = "1vVwXS6KYW9DFPwj7vijt-NgLIWZkZEDO";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function normalizeRows(rows) {
  const [header = [], ...body] = rows;
  const startIndex = header.findIndex((cell) => cell.toLowerCase() === "start");
  const endIndex = header.findIndex((cell) => cell.toLowerCase() === "end");
  const titleIndex = header.findIndex((cell) => cell.toLowerCase() === "title");

  if (startIndex === -1 || endIndex === -1 || titleIndex === -1) {
    throw new Error("Sheet must include start, end, and title columns.");
  }

  return body
    .map((row) => ({
      start: row[startIndex],
      end: row[endIndex],
      title: row[titleIndex],
    }))
    .filter((event) => event.start && event.end && event.title);
}

module.exports = async function handler(request, response) {
  try {
    const sheetResponse = await fetch(CSV_URL);

    if (!sheetResponse.ok) {
      throw new Error(`Google Sheets responded with ${sheetResponse.status}`);
    }

    const csv = await sheetResponse.text();
    const events = normalizeRows(parseCsv(csv));

    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({
      source: CSV_URL,
      updatedAt: new Date().toISOString(),
      events,
    });
  } catch (error) {
    response.status(500).json({
      error: "Failed to load schedule sheet.",
      message: error.message,
    });
  }
}
