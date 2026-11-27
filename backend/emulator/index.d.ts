/** Types for backend/emulator/index.js (Apps Script emulator; Node + browser). */

export interface EmulatorSource {
  name?: string;
  code: string;
}

export interface EmulatorCell {
  v: string | number | boolean;
  /** Formula text when the cell holds a formula. */
  f?: string;
  /** Number format, e.g. "@" for plain text. */
  n?: string;
  d?: 1;
}

export interface EmulatorSheetState {
  name: string;
  sheetId: number;
  frozenRows: number;
  /** Grid size (defaults 1000 × 26 like a new Google Sheets tab). */
  maxRows?: number;
  maxColumns?: number;
  rows: (EmulatorCell | null)[][];
}

export interface EmulatorSpreadsheetState {
  id: string;
  name: string;
  nextSheetId?: number;
  sheets: EmulatorSheetState[];
}

export interface EmulatorState {
  version: 1;
  properties: Record<string, string>;
  userProperties: Record<string, string>;
  cache: Record<string, { v: string; e: number }>;
  spreadsheets: Record<string, EmulatorSpreadsheetState>;
}

export interface EmulatorStorage {
  load(): EmulatorState | null;
  save(state: EmulatorState): void;
}

export interface EmulatorOptions {
  sources: (string | EmulatorSource)[];
  storage?: EmulatorStorage | null;
  /** Clock in epoch milliseconds (defaults to Date.now). */
  now?: () => number;
  /** Initial Script Properties (applied only to keys absent from the loaded state). */
  properties?: Record<string, string | number | boolean | null | undefined>;
  /** Initial spreadsheets (applied only to ids absent from the loaded state). */
  spreadsheets?: Record<string, EmulatorSpreadsheetState>;
  activeSpreadsheetId?: string;
  /** openById() of an unknown id creates an empty spreadsheet with "Sheet1" (default true). */
  autoCreateSpreadsheets?: boolean;
}

export interface EmulatorWriteEvent {
  type: string;
  sheet: string;
  row?: number;
  column?: number;
  numRows?: number;
  numColumns?: number;
}

export interface AppsScriptEmulator {
  readonly state: EmulatorState;
  readonly logs: { level: string; message: string }[];
  readonly hooks: { onWrite: ((e: EmulatorWriteEvent) => void) | null };
  readonly ui: {
    menus: { title: string; items: { caption?: string; fn?: string; separator?: boolean }[] }[];
    alerts: { title: string; message: string }[];
    prompts: { title: string; message: string }[];
    /** Answers for upcoming ui.prompt() calls (null = Cancel). */
    promptQueue: (string | null)[];
  };
  readonly functionNames: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doPost(body: string | object): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doGet(params?: Record<string, string>): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(fnName: string, ...args: unknown[]): any;
  getProperty(key: string): string | null;
  setProperty(key: string, value: string | null | undefined): void;
  /** Simulates another execution holding the script lock; returns a release function. */
  holdLock(): () => void;
  clearCache(): void;
  spreadsheet(id?: string): EmulatorSpreadsheetState | null;
  sheet(name: string, id?: string): EmulatorSheetState | null;
  sheetValues(name: string, id?: string): unknown[][];
  reset(): void;
}

export const BACKEND_SOURCE_FILES: readonly string[];
export const DEFAULT_SPREADSHEET_ID: string;
export function createAppsScriptEmulator(options: EmulatorOptions): AppsScriptEmulator;
