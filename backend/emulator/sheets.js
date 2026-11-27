/**
 * In-memory fake of the SpreadsheetApp subset used by backend/apps-script.
 *
 * State is plain JSON (so it can be persisted to localStorage):
 *   spreadsheets[id] = { id, name, sheets: [{ name, sheetId, frozenRows, rows: [[cell|null]] }] }
 *   cell = { v: value, f?: formula, n?: numberFormat, d?: 1 (value is an ISO date) }
 *
 * Value semantics mimic Google Sheets closely enough to make the backend's defences testable:
 *   - a string starting with "=" written to a cell that is not formatted as plain text ("@") becomes a FORMULA;
 *   - a leading apostrophe on such a cell is a text marker and is not stored;
 *   - numeric-looking strings become numbers unless the cell is formatted "@";
 *   - setValues() with mismatched dimensions throws, like Apps Script;
 *   - getRange() with zero rows/columns throws, like Apps Script.
 */

/** New Google Sheets tabs have a 1000 × 26 grid; getRange() outside the grid throws. */
const DEFAULT_MAX_ROWS = 1000;
const DEFAULT_MAX_COLUMNS = 26;
const maxRowsOf = (s) => Math.max(typeof s.maxRows === 'number' ? s.maxRows : DEFAULT_MAX_ROWS, s.rows.length);
const maxColumnsOf = (s) => Math.max(typeof s.maxColumns === 'number' ? s.maxColumns : DEFAULT_MAX_COLUMNS, ...s.rows.map((r) => (r ? r.length : 0)));

const NUMERIC_RE = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/;

function coerceForCell(value, numberFormat) {
  if (value === null || value === undefined) return { v: '' };
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return { v: Number.isNaN(value.getTime()) ? '' : value.toISOString(), d: 1 };
  }
  if (typeof value === 'number') return { v: Number.isFinite(value) ? value : '#NUM!' };
  if (typeof value === 'boolean') return { v: value };
  const s = String(value);
  if (numberFormat === '@') return { v: s };
  if (s.charAt(0) === '=' && s.length > 1) return { v: '', f: s };
  if (s.charAt(0) === "'") return { v: s.slice(1) };
  if (NUMERIC_RE.test(s)) return { v: Number(s) };
  if (/^(true|false)$/i.test(s)) return { v: s.toLowerCase() === 'true' };
  return { v: s };
}

export function createSheetsService(ctx) {
  const { state, hooks, DateCtor } = ctx;
  const ensureSpreadsheet = (id) => {
    if (!state.spreadsheets[id]) {
      if (!ctx.autoCreate) throw new Error(`Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.`);
      state.spreadsheets[id] = { id, name: 'Emulated spreadsheet', nextSheetId: 1, sheets: [{ name: 'Sheet1', sheetId: 0, frozenRows: 0, rows: [] }] };
    }
    return state.spreadsheets[id];
  };
  const notify = (info) => {
    if (hooks && typeof hooks.onWrite === 'function') hooks.onWrite(info);
  };

  class FakeRange {
    constructor(sheetState, row, col, numRows, numCols) {
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1) {
        throw new Error('Exception: The coordinates of the range are outside the dimensions of the sheet.');
      }
      if (!Number.isInteger(numRows) || numRows < 1) throw new Error('Exception: The number of rows in the range must be at least 1.');
      if (!Number.isInteger(numCols) || numCols < 1) throw new Error('Exception: The number of columns in the range must be at least 1.');
      if (row + numRows - 1 > maxRowsOf(sheetState) || col + numCols - 1 > maxColumnsOf(sheetState)) {
        throw new Error('Exception: The coordinates of the range are outside the dimensions of the sheet.');
      }
      this._s = sheetState;
      this._r = row;
      this._c = col;
      this._nr = numRows;
      this._nc = numCols;
    }
    _cell(r, c) {
      const row = this._s.rows[r - 1];
      return row ? row[c - 1] || null : null;
    }
    _setCell(r, c, cell) {
      const rows = this._s.rows;
      while (rows.length < r) rows.push([]);
      const row = rows[r - 1];
      while (row.length < c) row.push(null);
      row[c - 1] = cell;
    }
    _each(fn) {
      for (let i = 0; i < this._nr; i++) for (let j = 0; j < this._nc; j++) fn(this._r + i, this._c + j, i, j);
    }
    _matrix(fn) {
      const out = [];
      for (let i = 0; i < this._nr; i++) {
        const row = [];
        for (let j = 0; j < this._nc; j++) row.push(fn(this._cell(this._r + i, this._c + j)));
        out.push(row);
      }
      return out;
    }
    _checkDims(values, what) {
      if (!Array.isArray(values) || values.length !== this._nr) {
        throw new Error(`Exception: The number of rows in the data does not match the number of rows in the range. The data has ${Array.isArray(values) ? values.length : 0} but the range has ${this._nr}.`);
      }
      for (const row of values) {
        if (!Array.isArray(row) || row.length !== this._nc) {
          throw new Error(`Exception: The number of columns in the ${what} does not match the number of columns in the range. The data has ${Array.isArray(row) ? row.length : 0} but the range has ${this._nc}.`);
        }
      }
    }
    getRow() { return this._r; }
    getColumn() { return this._c; }
    getNumRows() { return this._nr; }
    getNumColumns() { return this._nc; }
    getLastRow() { return this._r + this._nr - 1; }
    getLastColumn() { return this._c + this._nc - 1; }
    getSheet() { return new FakeSheet(this._s); }
    getValues() {
      return this._matrix((cell) => {
        if (!cell || cell.f) return '';
        if (cell.d) return new DateCtor(cell.v);
        return cell.v;
      });
    }
    getDisplayValues() {
      return this._matrix((cell) => (!cell || cell.f ? '' : String(cell.v)));
    }
    getValue() { return this.getValues()[0][0]; }
    getFormulas() { return this._matrix((cell) => (cell && cell.f ? cell.f : '')); }
    getNumberFormats() { return this._matrix((cell) => (cell && cell.n ? cell.n : 'General')); }
    getNumberFormat() { return this.getNumberFormats()[0][0]; }
    setValues(values) {
      this._checkDims(values, 'data');
      this._each((r, c, i, j) => {
        const prev = this._cell(r, c);
        const n = prev && prev.n ? prev.n : undefined;
        const cell = coerceForCell(values[i][j], n);
        if (n) cell.n = n;
        this._setCell(r, c, cell);
      });
      notify({ type: 'setValues', sheet: this._s.name, row: this._r, column: this._c, numRows: this._nr, numColumns: this._nc });
      return this;
    }
    setValue(value) {
      return new FakeRange(this._s, this._r, this._c, 1, 1).setValues([[value]]);
    }
    setNumberFormats(formats) {
      this._checkDims(formats, 'formats');
      this._each((r, c, i, j) => {
        const prev = this._cell(r, c);
        this._setCell(r, c, Object.assign({ v: '' }, prev || {}, { n: String(formats[i][j]) }));
      });
      return this;
    }
    setNumberFormat(format) {
      const m = [];
      for (let i = 0; i < this._nr; i++) m.push(new Array(this._nc).fill(format));
      return this.setNumberFormats(m);
    }
    clearContent() {
      this._each((r, c) => {
        const prev = this._cell(r, c);
        if (prev) this._setCell(r, c, prev.n ? { v: '', n: prev.n } : null);
      });
      notify({ type: 'clearContent', sheet: this._s.name, row: this._r, column: this._c, numRows: this._nr, numColumns: this._nc });
      return this;
    }
    clear() {
      this._each((r, c) => this._setCell(r, c, null));
      notify({ type: 'clear', sheet: this._s.name, row: this._r, column: this._c, numRows: this._nr, numColumns: this._nc });
      return this;
    }
    // Formatting calls that have no observable effect in the emulator.
    setFontWeight() { return this; }
    setFontWeights() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setWrap() { return this; }
    setHorizontalAlignment() { return this; }
    setVerticalAlignment() { return this; }
  }

  const hasContent = (cell) => !!cell && (cell.f || (cell.v !== '' && cell.v !== null && cell.v !== undefined));

  class FakeSheet {
    constructor(sheetState) {
      this._s = sheetState;
    }
    getName() { return this._s.name; }
    getSheetId() { return this._s.sheetId; }
    getLastRow() {
      const rows = this._s.rows;
      for (let i = rows.length - 1; i >= 0; i--) if ((rows[i] || []).some(hasContent)) return i + 1;
      return 0;
    }
    getLastColumn() {
      let max = 0;
      for (const row of this._s.rows) {
        if (!row) continue;
        for (let j = row.length - 1; j >= max; j--) if (hasContent(row[j])) { max = j + 1; break; }
      }
      return max;
    }
    getMaxRows() { return maxRowsOf(this._s); }
    getMaxColumns() { return maxColumnsOf(this._s); }
    insertRowsAfter(afterPosition, howMany) {
      this._s.maxRows = maxRowsOf(this._s) + howMany;
      this._s.rows.splice(afterPosition, 0, ...Array.from({ length: Math.max(0, Math.min(howMany, this._s.rows.length - afterPosition)) }, () => []));
      return this;
    }
    insertColumnsAfter(afterPosition, howMany) {
      this._s.maxColumns = maxColumnsOf(this._s) + howMany;
      for (const row of this._s.rows) if (row && row.length > afterPosition) row.splice(afterPosition, 0, ...new Array(howMany).fill(null));
      return this;
    }
    getRange(row, col, numRows = 1, numCols = 1) {
      if (typeof row === 'string') throw new Error('A1 notation is not supported by the emulator');
      return new FakeRange(this._s, row, col, numRows, numCols);
    }
    getDataRange() {
      return new FakeRange(this._s, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
    }
    appendRow(values) {
      const r = this.getLastRow() + 1;
      if (r > maxRowsOf(this._s)) this._s.maxRows = r;
      if (values.length > maxColumnsOf(this._s)) this._s.maxColumns = values.length;
      new FakeRange(this._s, r, 1, 1, values.length).setValues([values]);
      return this;
    }
    deleteRow(rowPosition) {
      return this.deleteRows(rowPosition, 1);
    }
    deleteRows(rowPosition, howMany) {
      if (!Number.isInteger(rowPosition) || rowPosition < 1 || rowPosition + howMany - 1 > maxRowsOf(this._s)) {
        throw new Error('Exception: Those rows are out of bounds.');
      }
      const frozen = this._s.frozenRows || 0;
      if (maxRowsOf(this._s) - howMany <= frozen) throw new Error('Exception: Sorry, it is not possible to delete all non-frozen rows.');
      const max = maxRowsOf(this._s);
      this._s.rows.splice(rowPosition - 1, howMany);
      this._s.maxRows = max - howMany;
      notify({ type: 'deleteRows', sheet: this._s.name, row: rowPosition, numRows: howMany });
      return this;
    }
    setFrozenRows(n) { this._s.frozenRows = n; return this; }
    getFrozenRows() { return this._s.frozenRows || 0; }
    clear() { this._s.rows = []; notify({ type: 'clearSheet', sheet: this._s.name }); return this; }
    autoResizeColumns() { return this; }
    setColumnWidth() { return this; }
  }

  class FakeSpreadsheet {
    constructor(ssState) {
      this._ss = ssState;
    }
    getId() { return this._ss.id; }
    getName() { return this._ss.name; }
    getUrl() { return `https://docs.google.com/spreadsheets/d/${this._ss.id}/edit`; }
    getSheets() { return this._ss.sheets.map((s) => new FakeSheet(s)); }
    getSheetByName(name) {
      const s = this._ss.sheets.find((x) => x.name === name);
      return s ? new FakeSheet(s) : null;
    }
    insertSheet(name, index) {
      if (typeof name !== 'string' || !name) throw new Error('Exception: Invalid argument: sheetName');
      if (this._ss.sheets.some((x) => x.name === name)) {
        throw new Error(`Exception: A sheet with the name "${name}" already exists. Please enter another name.`);
      }
      const sheetId = this._ss.nextSheetId || this._ss.sheets.length + 1;
      this._ss.nextSheetId = sheetId + 1;
      const s = { name, sheetId, frozenRows: 0, maxRows: DEFAULT_MAX_ROWS, maxColumns: DEFAULT_MAX_COLUMNS, rows: [] };
      const at = Number.isInteger(index) ? Math.max(0, Math.min(index, this._ss.sheets.length)) : this._ss.sheets.length;
      this._ss.sheets.splice(at, 0, s);
      notify({ type: 'insertSheet', sheet: name });
      return new FakeSheet(s);
    }
    deleteSheet(sheet) {
      const i = this._ss.sheets.findIndex((x) => x.name === sheet.getName());
      if (i >= 0) this._ss.sheets.splice(i, 1);
      notify({ type: 'deleteSheet', sheet: sheet.getName() });
    }
    toast() {}
  }

  const ui = ctx.ui;
  return {
    openById(id) {
      return new FakeSpreadsheet(ensureSpreadsheet(String(id)));
    },
    getActiveSpreadsheet() {
      return new FakeSpreadsheet(ensureSpreadsheet(ctx.activeSpreadsheetId));
    },
    flush() {},
    getUi() {
      return ui;
    },
  };
}

/** Fake of SpreadsheetApp.getUi(): records menus and alerts, answers prompts from a queue. */
export function createUi() {
  const ButtonSet = { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' };
  const Button = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' };
  const record = { menus: [], alerts: [], prompts: [], promptQueue: [] };
  const ui = {
    ButtonSet,
    Button,
    createMenu(title) {
      const menu = { title, items: [] };
      const api = {
        addItem(caption, fn) { menu.items.push({ caption, fn }); return api; },
        addSeparator() { menu.items.push({ separator: true }); return api; },
        addSubMenu() { return api; },
        addToUi() { record.menus.push(menu); },
      };
      return api;
    },
    alert(title, message) {
      record.alerts.push({ title: String(title), message: message === undefined ? '' : String(message) });
      return Button.OK;
    },
    prompt(title, message) {
      record.prompts.push({ title: String(title), message: String(message || '') });
      const next = record.promptQueue.length ? record.promptQueue.shift() : null;
      return {
        getSelectedButton: () => (next === null ? Button.CANCEL : Button.OK),
        getResponseText: () => (next === null ? '' : String(next)),
      };
    },
  };
  return { ui, record };
}
