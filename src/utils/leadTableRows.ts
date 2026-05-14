/**
 * Maps CSV/Excel header + row to contact fields (aligned with backend LeadController heuristics).
 * Used to expand legacy "one Lead = whole file" records into one row per contact in the UI.
 */

export interface ApiLead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status: string;
  category?: string;
  file_name?: string;
  file_format?: string;
  file_headers?: string[];
  file_records?: string[][];
  value?: number;
  created_at: string;
  assigned_to?: string;
}

export interface LeadTableRow {
  rowKey: string;
  dbLeadId: number;
  /** 0-based index inside legacy file_records, or null for normal DB leads */
  legacyRowIndex: number | null;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status: string;
  category?: string;
  file_name?: string;
  created_at: string;
  raw_attributes: Record<string, string> | null;
  /** Present when this row came from an old file-batch lead (for full grid in modal) */
  legacyBatch: ApiLead | null;
}

function normalizeHeaderToken(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Remove CSV-style wrapping quotes. */
function stripCsvQuotes(s: string): string {
  let t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

/** Split on delimiter outside of double quotes (enough for typical IT CSV). */
function splitUnquotedDelimiter(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
      continue;
    }
    if (!inQuotes && c === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function extractRowStrings(rec: unknown): string[] {
  if (Array.isArray(rec)) {
    return rec.map((c) => String(c ?? '').trim());
  }
  if (typeof rec === 'string') {
    return [rec.trim()];
  }
  return [];
}

/**
 * Legacy imports sometimes stored each file row as one string (EU `;` CSV) while
 * `fgetcsv` had used comma — one DB cell per row. Re-split headers/row so columns align.
 */
export function coerceLegacyCsvShape(
  headers: string[],
  rec: unknown
): { headers: string[]; row: string[] } {
  let headerCells = headers.map((x) => stripCsvQuotes(String(x ?? '').trim()));

  if (headerCells.length === 1 && headerCells[0].includes(';')) {
    const parts = splitUnquotedDelimiter(headerCells[0], ';').map(stripCsvQuotes);
    if (parts.length > 1) {
      headerCells = parts;
    }
  } else if (headerCells.length === 1 && headerCells[0].includes(',') && !headerCells[0].includes(';')) {
    const parts = splitUnquotedDelimiter(headerCells[0], ',').map(stripCsvQuotes);
    if (parts.length > 1) {
      headerCells = parts;
    }
  }

  let cells = extractRowStrings(rec);

  if (cells.length === 1) {
    const s = cells[0];
    const bySemi = splitUnquotedDelimiter(s, ';').map(stripCsvQuotes);
    const byComma = splitUnquotedDelimiter(s, ',').map(stripCsvQuotes);

    if (headerCells.length > 1) {
      if (bySemi.length === headerCells.length) {
        cells = bySemi;
      } else if (byComma.length === headerCells.length) {
        cells = byComma;
      } else if (bySemi.length >= byComma.length && bySemi.length > 1) {
        cells = bySemi;
      } else if (byComma.length > 1) {
        cells = byComma;
      }
    } else {
      cells =
        bySemi.length >= byComma.length && bySemi.length > 1
          ? bySemi
          : byComma.length > 1
            ? byComma
            : [stripCsvQuotes(s)];
      if (headerCells.length === 1 && cells.length > 1) {
        headerCells = cells.map((_, i) => `Column ${i + 1}`);
      }
    }
  }

  while (cells.length < headerCells.length) {
    cells.push('');
  }
  if (cells.length > headerCells.length) {
    cells = cells.slice(0, headerCells.length);
  }

  return { headers: headerCells, row: cells };
}

function headerLooksLikeEmail(norm: string): boolean {
  if (norm === 'mail' || norm === 'e-mail' || norm === 'email') return true;
  if (norm.includes('email') || norm.includes('e-mail')) return true;
  if (norm.includes('pec')) return true;
  return false;
}

function headerLooksLikePhone(norm: string): boolean {
  for (const token of ['telefono', 'cellulare', 'mobile', 'phone', 'tel', 'fax', 'whatsapp']) {
    if (norm.includes(token)) return true;
  }
  return false;
}

type NormPair = { norm: string; value: string; label: string };

function pickNameFromRow(normPairs: NormPair[]): string {
  const priorityFragments: string[][] = [
    ['ragione sociale'],
    ['insegna'],
    ['denominazione'],
    ['company', 'name'],
    ['company'],
    ['azienda'],
    ['business', 'name'],
    ['nome', 'completo'],
    ['full', 'name'],
    ['cognome', 'nome'],
    ['nome', 'cognome'],
    ['nome', 'e', 'cognome'],
    ['first', 'name'],
    ['last', 'name'],
    ['nome'],
    ['cognome'],
    ['name'],
    ['titolo'],
    ['contact'],
  ];

  for (const fragments of priorityFragments) {
    for (const pair of normPairs) {
      if (!pair.value) continue;
      const ok = fragments.every((f) => pair.norm.includes(f));
      if (ok) return pair.value;
    }
  }

  for (const pair of normPairs) {
    if (!pair.value) continue;
    if (headerLooksLikeEmail(pair.norm) || headerLooksLikePhone(pair.norm)) continue;
    if (pair.norm.includes('name') || pair.norm.includes('nome') || pair.norm.includes('cognome')) {
      return pair.value;
    }
  }

  return '';
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return digits || value.trim();
}

export function mapLeadImportRow(headers: string[], row: (string | number | null | undefined)[] | unknown): {
  name: string;
  email?: string;
  phone?: string;
  raw: Record<string, string>;
} {
  const { headers: h, row: coerced } = coerceLegacyCsvShape(
    headers.map((x) => String(x ?? '')),
    row
  );
  const rowStr = coerced.map((c) => String(c ?? '').trim());
  const raw: Record<string, string> = {};
  h.forEach((headerLabel, i) => {
    const label = String(headerLabel ?? '').trim();
    const cell = rowStr[i] ?? '';
    if (label && cell) raw[label] = cell;
  });

  const normPairs: NormPair[] = h.map((headerLabel, i) => ({
    norm: normalizeHeaderToken(String(headerLabel ?? '')),
    value: rowStr[i] ?? '',
    label: String(headerLabel ?? ''),
  })).filter((p) => p.norm);

  let email: string | undefined;
  for (const pair of normPairs) {
    if (!pair.value) continue;
    if (headerLooksLikeEmail(pair.norm) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pair.value)) {
      email = pair.value;
      break;
    }
  }

  let phone: string | undefined;
  for (const pair of normPairs) {
    if (!pair.value) continue;
    if (headerLooksLikePhone(pair.norm)) {
      phone = normalizePhone(pair.value);
      break;
    }
  }

  let name = pickNameFromRow(normPairs);
  if (!name) {
    const firstVal = Object.values(raw)[0];
    name = email || phone || firstVal || 'Unnamed lead';
  }

  return { name, email, phone, raw };
}

export function isLegacyBatchLead(lead: ApiLead): boolean {
  return Array.isArray(lead.file_records) && lead.file_records.length > 0 && Array.isArray(lead.file_headers) && lead.file_headers.length > 0;
}

/** Keeps the Leads table usable when a legacy import stored many rows in one lead record. */
const MAX_LEGACY_ROWS_PER_LEAD = 1500;

export function expandApiLeadsToTableRows(leads: ApiLead[]): LeadTableRow[] {
  const out: LeadTableRow[] = [];
  for (const lead of leads) {
    if (isLegacyBatchLead(lead)) {
      const headers = lead.file_headers!.map((h) => String(h ?? ''));
      let idx = 0;
      const cappedRecords = lead.file_records!.slice(0, MAX_LEGACY_ROWS_PER_LEAD);
      for (const rec of cappedRecords) {
        const mapped = mapLeadImportRow(headers, rec);
        if (Object.keys(mapped.raw).length === 0) {
          idx += 1;
          continue;
        }
        out.push({
          rowKey: `${lead.id}-r${idx}`,
          dbLeadId: lead.id,
          legacyRowIndex: idx,
          name: mapped.name,
          email: mapped.email,
          phone: mapped.phone,
          source: lead.source,
          status: lead.status,
          category: lead.category,
          file_name: lead.file_name,
          created_at: lead.created_at,
          raw_attributes: mapped.raw,
          legacyBatch: lead,
        });
        idx += 1;
      }
    } else {
      out.push({
        rowKey: String(lead.id),
        dbLeadId: lead.id,
        legacyRowIndex: null,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        category: lead.category,
        file_name: lead.file_name,
        created_at: lead.created_at,
        raw_attributes: lead.raw_attributes ?? null,
        legacyBatch: null,
      });
    }
  }
  return out;
}

export function filterTableRowsBySearch(rows: LeadTableRow[], searchRaw: string): LeadTableRow[] {
  const q = searchRaw.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    if (row.email?.toLowerCase().includes(q)) return true;
    if (row.phone?.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) return true;
    if (row.file_name?.toLowerCase().includes(q)) return true;
    if (row.category?.toLowerCase().includes(q)) return true;
    for (const v of Object.values(row.raw_attributes || {})) {
      if (String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export type ImportFilter = { field: string; value: string };

function findRawKey(raw: Record<string, string>, wantedField: string): string | undefined {
  const w = wantedField.trim().toLowerCase();
  if (!w) return undefined;
  const exact = Object.keys(raw).find((k) => k.toLowerCase() === w);
  if (exact) return exact;
  return Object.keys(raw).find((k) => k.toLowerCase().includes(w) || w.includes(k.toLowerCase()));
}

/** Refine expanded rows by import column + value (AND across filters). Mirrors backend intent for legacy rows. */
export function filterTableRowsByImportFilters(rows: LeadTableRow[], filters: ImportFilter[]): LeadTableRow[] {
  const active = filters
    .map((f) => ({ field: f.field.trim(), value: f.value.trim() }))
    .filter((f) => f.value.length > 0);
  if (active.length === 0) return rows;

  return rows.filter((row) =>
    active.every((f) => {
      const raw = row.raw_attributes || {};
      const needle = f.value.toLowerCase();
      if (!f.field) {
        return Object.values(raw).some((v) => String(v).toLowerCase().includes(needle));
      }
      const key = findRawKey(raw, f.field);
      if (!key) return false;
      return String(raw[key]).toLowerCase().includes(needle);
    })
  );
}

const RAW_KEYS_SKIP_NORMALIZED = new Set([
  'email',
  'e-mail',
  'mail',
  'pec',
  'telefono',
  'cellulare',
  'mobile',
  'phone',
  'tel',
  'fax',
  'nome',
  'cognome',
  'name',
  'ragione sociale',
  'denominazione',
  'azienda',
  'company',
  'first name',
  'last name',
  'full name',
  'nome e cognome',
  'nome completo',
]);

function rawKeyEligibleForDynamicColumn(label: string): boolean {
  const n = normalizeHeaderToken(label);
  if (n.length === 0 || n.length > 80) return false;
  if (RAW_KEYS_SKIP_NORMALIZED.has(n)) return false;
  return true;
}

/** Most frequent non-core import headers on the current result set (for extra table columns). */
export function computeTopRawAttributeKeys(rows: LeadTableRow[], maxKeys: number, sample = 800): string[] {
  const counts = new Map<string, number>();
  const limit = Math.min(rows.length, sample);
  for (let i = 0; i < limit; i++) {
    const raw = rows[i]?.raw_attributes;
    if (!raw) continue;
    for (const [k, v] of Object.entries(raw)) {
      const label = k.trim();
      if (!label || !String(v).trim()) continue;
      if (!rawKeyEligibleForDynamicColumn(label)) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxKeys)
    .map(([k]) => k);
}
