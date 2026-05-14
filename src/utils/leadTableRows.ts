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

export function mapLeadImportRow(headers: string[], row: (string | number | null | undefined)[]): {
  name: string;
  email?: string;
  phone?: string;
  raw: Record<string, string>;
} {
  const rowStr = row.map((c) => String(c ?? '').trim());
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    const label = String(h ?? '').trim();
    const cell = rowStr[i] ?? '';
    if (label && cell) raw[label] = cell;
  });

  const normPairs: NormPair[] = headers.map((h, i) => ({
    norm: normalizeHeaderToken(String(h ?? '')),
    value: rowStr[i] ?? '',
    label: String(h ?? ''),
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
