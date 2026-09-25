/**
 * Maps CSV/Excel header + row to contact fields (aligned with backend LeadController heuristics).
 * Used to expand legacy "one Lead = whole file" records into one row per contact in the UI.
 */

export interface ApiLead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  age?: string;
  gender?: string;
  country?: string;
  city?: string;
  date_of_birth?: string;
  intention?: string;
  source?: string;
  status: string;
  category?: string;
  file_name?: string;
  file_format?: string;
  file_headers?: string[];
  file_records?: string[][];
  raw_attributes?: Record<string, string> | null;
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
  mobile?: string;
  age?: string;
  gender?: string;
  country?: string;
  city?: string;
  date_of_birth?: string;
  intention?: string;
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-/\\.:]+/g, ' ')
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
  const compact = norm.replace(/\s+/g, '');
  if (compact === 'mail' || compact === 'email') return true;
  if (compact.includes('email') || compact.includes('mail')) return true;
  if (norm.includes('pec')) return true;
  return false;
}

function headerLooksLikePhone(norm: string): boolean {
  if (headerLooksLikeMobile(norm)) return false;
  for (const token of ['telefono', 'telephone', 'phone', 'tel', 'landline', 'fisso', 'fax']) {
    if (norm.includes(token)) return true;
  }
  return false;
}

function headerLooksLikeMobile(norm: string): boolean {
  const compact = norm.replace(/\s+/g, '');
  return ['telefonino', 'cellulare', 'mobile', 'gsm', 'cell', 'whatsapp', 'phone2', 'secondphone', 'secondaryphone']
    .some((token) => compact.includes(token));
}

function headerLooksLikeAge(norm: string): boolean {
  return ['age', 'eta', 'anni'].includes(norm) || norm.includes('age');
}

function headerLooksLikeDateOfBirth(norm: string): boolean {
  return norm.includes('data nascita')
    || norm.includes('date of birth')
    || norm.includes('birth date')
    || norm === 'dob';
}

function headerLooksLikeGender(norm: string): boolean {
  return ['gender', 'sesso', 'sex'].includes(norm);
}

function headerLooksLikeCountry(norm: string): boolean {
  return ['country', 'paese', 'nazione', 'stato'].includes(norm) || norm.includes('country');
}

function headerLooksLikeCity(norm: string): boolean {
  return ['city', 'citta', 'comune', 'localita', 'municipality'].includes(norm)
    || norm.includes('city')
    || norm.includes('citta');
}

function headerLooksLikeIntention(norm: string): boolean {
  return norm.includes('intention')
    || norm.includes('intenzione')
    || norm.includes('interesse')
    || norm.includes('interest')
    || norm === 'intent'
    || norm.includes('lead intent');
}

function normalizeAge(value: string): string | undefined {
  const match = value.match(/\b(\d{1,3})\b/);
  if (!match) return undefined;
  const age = Number(match[1]);
  return age >= 0 && age <= 130 ? String(age) : undefined;
}

function calculateAgeFromDateValue(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  let date: Date | undefined;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 1000 && numeric < 100000) {
    // Excel's 1900 date system; this is only a fallback for legacy rows.
    date = new Date(Date.UTC(1899, 11, 30) + numeric * 86400000);
  }

  if (!date) {
    const match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (match) {
      date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    }
  }

  if (!date || Number.isNaN(date.getTime()) || date > new Date()) return undefined;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const birthdayNotReached = today.getUTCMonth() < date.getUTCMonth()
    || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 && age <= 130 ? String(age) : undefined;
}

/** Convert the common spreadsheet formats used by legacy lead imports to ISO. */
function normalizeDateOfBirth(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 1000 && numeric < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + numeric * 86400000).toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const yearFirstMatch = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (yearFirstMatch) {
    const iso = `${yearFirstMatch[1]}-${yearFirstMatch[2].padStart(2, '0')}-${yearFirstMatch[3].padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : iso;
  }
  const match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return undefined;
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : iso;
}

type NormPair = { norm: string; value: string; label: string };

function pickNameFromRow(normPairs: NormPair[]): string {
  let firstName = '';
  let lastName = '';
  for (const pair of normPairs) {
    if (!pair.value) continue;
    if (!firstName && isFirstNameHeader(pair.norm)) firstName = pair.value;
    if (!lastName && isLastNameHeader(pair.norm)) lastName = pair.value;
  }
  if (firstName || lastName) return `${firstName} ${lastName}`.trim();

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
    ['name'],
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

function isFirstNameHeader(norm: string): boolean {
  return ['nome', 'first name', 'firstname', 'given name'].includes(norm) || norm.includes('first name');
}

function isLastNameHeader(norm: string): boolean {
  return ['cognome', 'last name', 'lastname', 'surname', 'family name'].includes(norm)
    || norm.includes('last name')
    || norm.includes('surname');
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return digits || value.trim();
}

export function mapLeadImportRow(headers: string[], row: (string | number | null | undefined)[] | unknown): {
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  age?: string;
  gender?: string;
  country?: string;
  intention?: string;
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
    if (!label || !cell) return;
    let key = label;
    let duplicate = 2;
    while (raw[key] !== undefined) {
      key = `${label} (${duplicate})`;
      duplicate += 1;
    }
    raw[key] = cell;
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
  let mobile: string | undefined;
  for (const pair of normPairs) {
    if (!pair.value) continue;
    if (headerLooksLikeMobile(pair.norm)) {
      if (!mobile) mobile = normalizePhone(pair.value);
      continue;
    }
    if (headerLooksLikePhone(pair.norm)) {
      if (!phone) phone = normalizePhone(pair.value);
    }
  }

  // Preserve a second generic phone column as mobile when its header is not
  // specific enough to identify it as a mobile number.
  if (phone && !mobile) {
    for (const pair of normPairs) {
      if (!pair.value || !headerLooksLikePhone(pair.norm)) continue;
      const candidate = normalizePhone(pair.value);
      if (candidate !== phone) {
        mobile = candidate;
        break;
      }
    }
  }

  const firstImportValue = (matcher: (norm: string) => boolean): string | undefined =>
    normPairs.find((pair) => pair.value && matcher(pair.norm))?.value;
  const dateOfBirth = firstImportValue(headerLooksLikeDateOfBirth);
  const ageValue = firstImportValue(headerLooksLikeAge);
  const age = normalizeAge(ageValue || '') || calculateAgeFromDateValue(dateOfBirth);
  const gender = firstImportValue(headerLooksLikeGender);
  const country = firstImportValue(headerLooksLikeCountry);
  const city = firstImportValue(headerLooksLikeCity);
  const intention = firstImportValue(headerLooksLikeIntention);

  let name = pickNameFromRow(normPairs);
  if (!name) {
    const firstVal = Object.values(raw)[0];
    name = email || phone || mobile || firstVal || 'Unnamed lead';
  }

  return { name, email, phone, mobile, age, gender, country, city, date_of_birth: normalizeDateOfBirth(dateOfBirth), intention, raw };
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
          mobile: mapped.mobile,
          age: mapped.age,
          gender: mapped.gender,
          country: mapped.country,
          city: mapped.city,
          date_of_birth: mapped.date_of_birth,
          intention: mapped.intention,
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
        mobile: lead.mobile,
        age: lead.age,
        gender: lead.gender,
        country: lead.country,
        city: lead.city,
        date_of_birth: lead.date_of_birth,
        intention: lead.intention,
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
    if (row.mobile?.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) return true;
    if (row.age?.toLowerCase().includes(q)) return true;
    if (row.gender?.toLowerCase().includes(q)) return true;
    if (row.country?.toLowerCase().includes(q)) return true;
    if (row.intention?.toLowerCase().includes(q)) return true;
    if (row.file_name?.toLowerCase().includes(q)) return true;
    if (row.category?.toLowerCase().includes(q)) return true;
    for (const v of Object.values(row.raw_attributes || {})) {
      if (String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export type LeadFieldFilters = {
  age: string;
  gender: string;
  country: string;
  city: string;
  intention: string;
  date_of_birth_from: string;
  date_of_birth_to: string;
};

/** Applies the dedicated Leads filters to both modern and legacy-expanded rows. */
export function filterTableRowsByLeadFields(rows: LeadTableRow[], filters: LeadFieldFilters): LeadTableRow[] {
  const active = (Object.entries(filters) as Array<[keyof LeadFieldFilters, string]>)
    .map(([field, value]) => [field, value.trim().toLowerCase()] as const)
    .filter(([, value]) => value.length > 0);
  if (active.length === 0) return rows;

  return rows.filter((row) => active.every(([field, value]) => {
    if (field === 'date_of_birth_from') {
      return Boolean(row.date_of_birth && row.date_of_birth >= value);
    }
    if (field === 'date_of_birth_to') {
      return Boolean(row.date_of_birth && row.date_of_birth <= value);
    }
    const actual = String(row[field] ?? '').trim().toLowerCase();
    return actual.includes(value);
  }));
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
  'telefonino',
  'telefonino gsm',
  'cellulare',
  'mobile',
  'gsm',
  'whatsapp',
  'phone',
  'tel',
  'fax',
  'age',
  'eta',
  'anni',
  'gender',
  'sesso',
  'sex',
  'country',
  'paese',
  'nazione',
  'stato',
  'intention',
  'intenzione',
  'interesse',
  'interest',
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
