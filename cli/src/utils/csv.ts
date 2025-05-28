import { homedir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { spinner } from "@/program";

export class CSV {
  private data: string[][] = [];
  private headers: string[] = [];

  /**
   * Creates a new CSV instance from a JSON array of objects
   * @param jsonData Array of objects to convert to CSV
   * @returns CSV instance
   */
  static fromJSON<T extends Record<string, any>>(jsonData: T[]): CSV {
    const csv = new CSV();

    if (jsonData.length === 0) {
      return csv;
    }

    // Get headers from first object
    csv.headers = Object.keys(jsonData[0]);
    csv.data = [csv.headers];

    // Add data rows
    jsonData.forEach((item) => {
      const row = csv.headers.map((header) => {
        const value = item[header];
        // Handle nested objects and arrays
        if (typeof value === "object" && value !== null) {
          return JSON.stringify(value);
        }
        return String(value ?? "");
      });
      csv.data.push(row);
    });

    return csv;
  }

  /**
   * Reads a CSV file and returns a CSV instance
   * @param filePath Path to the CSV file
   * @returns CSV instance
   */
  static read(filePath: string): CSV {
    const csv = new CSV();
    const content = readFileSync(filePath, "utf-8");

    // Split content into lines and handle both CRLF and LF
    const lines = content.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      return csv;
    }

    // Parse headers
    csv.headers = this.parseCSVLine(lines[0]);
    csv.data = [csv.headers];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCSVLine(lines[i]);
      if (row.length === csv.headers.length) {
        csv.data.push(row);
      }
    }

    return csv;
  }

  /**
   * Saves the CSV file to the Desktop folder
   * @param filename Name of the file (without extension)
   * @returns Full path to the saved file
   */
  save(headers: string[], filename: string, output: string): string {
    const baseFolder = join(`${homedir()}/forest-emissions`);
    const date = new Date();
    const dayFolder = date.toISOString().split("T")[0]; // "2024-02-20"

    // Create: ~/forest-emissions/output/2024-02-20/
    const dailyFolder = join(baseFolder, output, dayFolder);
    mkdirSync(dailyFolder, { recursive: true }); // Creates all missing parent dirs

    // Filename: "data-2024-02-20T14:30:00.000Z.csv" (ISO timestamp)
    const timestamp = date.toISOString();
    const filePath = join(dailyFolder, `${filename}-${timestamp}.csv`);

    // Generate CSV content
    const slicedData = this.data.slice(1); // Exclude headers
    const data = [headers, ...slicedData];
    const content = data
      .map((row) => row.map((cell) => this.escapeCSV(cell)).join(","))
      .join("\n");
    writeFileSync(filePath, content);
    spinner.succeed(`CSV saved to ${filePath}`);
    return filePath;
  }
  /**
   * Gets the CSV data as a string
   * @returns CSV content as string
   */
  toString(): string {
    return this.data
      .map((row) => row.map((cell) => this.escapeCSV(cell)).join(","))
      .join("\n");
  }

  /**
   * Gets the headers of the CSV
   * @returns Array of header names
   */
  getHeaders(): string[] {
    return [...this.headers];
  }

  /**
   * Gets the data rows of the CSV
   * @returns Array of data rows
   */
  getData(): string[][] {
    return this.data.slice(1); // Exclude headers
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current);
    return result;
  }

  private escapeCSV(value: string): string {
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
