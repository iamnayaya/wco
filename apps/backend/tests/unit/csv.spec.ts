import { parseCsv, toCsv } from '../../src/modules/customers/csv.util.js';

describe('parseCsv', () => {
  it('parses simple rows and lowercases headers', () => {
    const out = parseCsv('Phone,Name\n+2348012345678,Nkechi\n');
    expect(out.headers).toEqual(['phone', 'name']);
    expect(out.rows).toEqual([{ phone: '+2348012345678', name: 'Nkechi' }]);
  });

  it('handles quoted fields with commas, quotes and newlines', () => {
    const csv = 'name,notes\n"Okafor, Nkechi","Line1\nLine2 ""best"" seller"\n';
    const out = parseCsv(csv);
    expect(out.rows[0].name).toBe('Okafor, Nkechi');
    expect(out.rows[0].notes).toBe('Line1\nLine2 "best" seller');
  });

  it('tolerates CRLF line endings and missing trailing newline', () => {
    const out = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(out.rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const out = parseCsv('\uFEFFphone\n+2348000000000');
    expect(out.headers).toEqual(['phone']);
  });

  it('rejects empty files', () => {
    expect(() => parseCsv('\uFEFF\r\n')).toThrow(/empty/i);
  });

  it('pads short rows with empty strings', () => {
    const out = parseCsv('a,b,c\n1,2\n');
    expect(out.rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });
});

describe('toCsv', () => {
  it('escapes quotes/commas/newlines per RFC 4180', () => {
    const csv = toCsv(['name', 'note'], [{ name: 'Okafor, Nkechi', note: 'say "hi"' }]);
    expect(csv).toContain('"Okafor, Nkechi"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('emits BOM + CRLF for Excel compatibility', () => {
    const csv = toCsv(['a'], [{ a: 1 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('neutralizes formula-injection prefixes', () => {
    const csv = toCsv(['cmd'], [{ cmd: '=HYPERLINK("http://evil")' }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('=HYPERLINK("http');
    const dash = toCsv(['v'], [{ v: '-2+3' }]);
    expect(dash).toContain("'-2+3");
  });
});
