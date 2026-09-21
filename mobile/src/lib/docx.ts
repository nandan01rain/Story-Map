import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import type { Chapter } from '../store/chapterStore';
import { bookName, chapterNumberInBook } from './storyData';

// A Word document, built by hand. A .docx is a zip of XML, and the smallest one that Word,
// Pages, Google Docs and Vellum all open is four files: the content-types list, the package
// relationships, the document, and a styles part so headings are real headings rather than
// big bold text. jszip is already here for the EPUB; nothing new ships for this.
//
// The manuscript goes out in standard manuscript shape, which is what an editor, an agent or
// a typesetter expects to receive: a title page, each book a part, each chapter starting on a
// new page under "Chapter N" and its title, paragraphs double-spaced with a first-line
// indent, no blank lines between them. Vellum's importer keys on exactly these headings.
//
// Formatting beyond that is deliberately not attempted. Export clean text and let the tool
// built for typesetting do the typesetting.

export type DocxScope = { bookIndex: number | null };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function para(text: string, style?: string, opts: { pageBreakBefore?: boolean; center?: boolean } = {}): string {
  const pPr =
    style || opts.pageBreakBefore || opts.center
      ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${opts.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}${opts.center ? '<w:jc w:val="center"/>' : ''}</w:pPr>`
      : '';
  // xml:space preserves leading/trailing spaces; a run per line keeps soft breaks.
  const runs = text
    .split('\n')
    .map((line, i) => `${i > 0 ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`)
    .join('');
  return `<w:p>${pPr}${runs}</w:p>`;
}

function proseParagraphs(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => para(p, 'Prose'))
    .join('');
}

export function docxFilename(projectName: string, scope: DocxScope): string {
  const book = scope.bookIndex === null ? '' : ` - ${bookName(scope.bookIndex)}`;
  return `${projectName}${book}`.replace(/[\\/:*?"<>|]/g, '-') + '.docx';
}

function buildDocument(projectName: string, chapters: Chapter[], scope: DocxScope): string {
  const body: string[] = [];
  const title = scope.bookIndex === null ? projectName : `${projectName}\n${bookName(scope.bookIndex)}`;
  body.push(para(title, 'Title', { center: true }));
  body.push(para(`${chapters.reduce((n, c) => n + (c.content?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0).toLocaleString()} words`, 'Subtitle', { center: true }));

  let lastBook: number | null = null;
  for (const ch of chapters) {
    if (scope.bookIndex === null && ch.book !== lastBook) {
      body.push(para(bookName(ch.book), 'Heading1', { pageBreakBefore: true, center: true }));
      lastBook = ch.book;
    }
    const n = chapterNumberInBook(ch, chapters);
    body.push(para(n ? `Chapter ${n}` : 'Chapter', 'Heading2', { pageBreakBefore: true, center: true }));
    body.push(para(ch.title, 'Heading3', { center: true }));
    body.push(proseParagraphs(ch.content ?? ''));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="480" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Prose"><w:name w:val="Prose"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="720"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="4800" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="4800" w:after="480"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="2400" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="720"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

export async function exportDocx(
  projectName: string,
  chapters: Chapter[],
  scope: DocxScope,
): Promise<{ error: string | null }> {
  if (chapters.length === 0) return { error: 'Nothing to export — no chapters in this selection.' };
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')!.file('.rels', RELS);
  const word = zip.folder('word')!;
  word.file('document.xml', buildDocument(projectName, chapters, scope));
  word.file('styles.xml', STYLES);
  word.folder('_rels')!.file('document.xml.rels', DOC_RELS);

  try {
    const base64 = await zip.generateAsync({ type: 'base64' });
    const file = new File(Paths.cache, docxFilename(projectName, scope));
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: 'base64' });
    if (!(await Sharing.isAvailableAsync())) {
      return { error: 'The file was written, but this device has no way to share it.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dialogTitle: 'Export as Word',
      UTI: 'org.openxmlformats.wordprocessingml.document',
    });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not write the file.' };
  }
}
