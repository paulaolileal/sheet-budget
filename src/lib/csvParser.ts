import Papa from "papaparse";

/** Parses a CSV File into plain objects keyed by trimmed, lowercased header. */
export function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => resolve(result.data),
      error: (err) => reject(err),
    });
  });
}
