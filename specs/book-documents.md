# Book Documents

Structured book support inside the existing custom-documents feature: pages, chapters
and paragraphs, so a book can be read and cited the way its publisher intended.

## 1. Why

The library indexes **sermons** in Tantivy. Sermons are cited as
`paragraph N` — the transcript numbering is stable across editions, so a listener can
verify a quote. That convention is baked into `data.sqlite`, the reference resolver and
the Tantivy index.

Some works are **books**, not sermons — `An Exposition of the Seven Church Ages` being the
one that motivated this. A book is cited as `page N, paragraph M`. It has chapters, front
matter, running headers and printed page numbers. It cannot go into the sermon index
without corrupting the citation model.

Custom documents are the right home for it, but today they flatten every import to a list
of paragraphs. A 374-page book becomes ~4000 undifferentiated paragraphs with no pages, no
chapters, and no way to cite a passage.

**Goal.** Import a book as a custom document and preserve its structure, with citation
fidelity high enough that a reader can check a reference against the printed edition.

## 2. Scope

|         |                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **In**  | Page boundaries, printed page numbers, chapter/section titles, paragraph numbering within the document, front-matter exclusion, running header/footer removal, a dedicated reader view, structural citations |
| **In**  | Any language and script — Latin, Cyrillic, Greek, CJK, RTL                                                                                                                                                   |
| **In**  | All formats custom documents already accept: pdf, epub, docx, md, txt                                                                                                                                        |
| **Out** | Adding books to the Tantivy sermon index                                                                                                                                                                     |
| **Out** | OCR of scanned/image-only PDFs                                                                                                                                                                               |
| **Out** | Reflowable pagination (page numbers come from the source, never invented)                                                                                                                                    |
| **Out** | Any per-title special-casing. No code may branch on a specific book                                                                                                                                          |

## 3. Accuracy targets

- **≥ 99%** on VGR-published books (the `ages` family), measured as correct
  `(page, paragraph)` attribution per paragraph. _Measured: 100% on both, 10/10 chapters._
- **≥ 95%** on arbitrary third-party books, restricted to what that can honestly mean:
  a **born-digital PDF whose text layer decodes**. Measured over the 29-file third-party
  corpus of §10 — 12 publishers, 9 scripts — 24 of 25 such files import as books with a
  strictly consistent folio run and chapter counts at or above the book's own contents
  page. It is **not** claimed for OCR'd scans (folio recovery 21–81%, two of four fall
  back) or for files whose fonts carry no usable `ToUnicode` map (two in the corpus,
  both correctly rejected).
- **100%** on the safety property: a document that cannot be parsed confidently must fall
  back to today's plain behaviour. **A wrong structure is worse than no structure** — a
  misattributed citation is a correctness failure the user cannot detect. _Measured: 0
  false positives over 73 sermon PDFs._

## 4. Evidence from the corpus

Measured on the real files, not assumed. Corpus assembled from `branham.fr` and
`en.branham.ru` (see §10).

### 4.1 The book files

|                             | EN `ages`                                                                     | FR `expose`                      |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| PDF pages                   | 382                                                                           | 374                              |
| Blank pages                 | 5                                                                             | 4                                |
| Pages with a printed number | 371                                                                           | 357                              |
| `pdf_index − printed_page`  | **0 for all 371**                                                             | **0 for all 357**                |
| Running header              | `<n>␣␣AN EXPOSITION OF THE SEVEN CHURCH AGES` (verso) / chapter title (recto) | `<n>␣␣LES SEPT ÂGES DE L'ÉGLISE` |
| Running footer              | `ENG.␣␣<CHAPTER>␣␣P<n>␣␣REV #: <n>`                                           | present, **mojibake**            |

The offset being uniformly 0 is a property of _these_ files, not a rule. The printed number
must always be read from the page, never computed.

### 4.2 Paragraphs are marked by first-line indent, not blank lines

Line-indent histogram (leading spaces, `pdftotext -layout`, excluding header/footer):

```
EN:  indent 0 → 13707 lines   indent 3 → 996   indent 2 → 168   indent 4 → 85
FR:  indent 0 → 15026 lines   indent 4 → 803   indent 5 → 400   indent 3 → 44
```

Continuation lines sit flush left; a paragraph's **first** line is indented. Blank lines do
not separate paragraphs. This is why the current importer mis-segments books: its
`buildParagraphsFromLines` merges by sentence heuristics and never looks at indentation.

Via PDF.js the same signal is available with far better fidelity as **x-coordinates**.
Body page 30 of the EN book yields distinct x starts at `38, 50, 72, 84, 88, 95, 124, 133` —
the body column starts at one x, indented first lines at another. Clustering x per page
separates them without guessing.

### 4.3 Broken font encodings are real and must be survived

Page 5 of the EN book extracts as `7),,)!-␣-!22)/.␣"2!.(!-` under **both** poppler and
PDF.js. The font (`g_d0_f3`) has no usable ToUnicode CMap; the glyph codes are the intended
characters shifted by a constant `0x20`. The FR running footer has the same defect.

Body text is unaffected — the mojibake is confined to decorative/title pages using that one
font. The pipeline must **detect** unusable text and exclude it rather than emit garbage.
Do not attempt to reverse the shift: the offset is not a documented invariant and guessing
it would corrupt real text.

Detection heuristic: a run of text whose characters are overwhelmingly ASCII punctuation and
digits, with near-zero letter frequency in any script, while the page's font differs from
the document's dominant body font.

### 4.4 Sermons are structurally distinct

The other archives on those sites (`7seals`, `COD`, `Hebrews`, `Daniel`, `Revelation`,
`adoption`, `Israel_and_the_Church`) contain **sermon** transcripts named by date
(`63-0319.pdf`), not books. They carry inline paragraph numbers and no chapter structure.

This is the negative class the detector must reject: importing a sermon PDF must continue to
behave exactly as today. It is also a ready-made corpus of ~59 non-book PDFs for testing
false positives.

## 5. Design

### 5.1 Structure-first, AI-assisted only where structure is ambiguous

Deterministic extraction is the primary path. AI is a _refinement_ pass, never the source of
page or paragraph boundaries.

Reasoning:

- The app is **offline-first**. Import must work with no network and no AI provider
  configured. Structure that depends on a remote model is structure most users won't get.
- The invariants in §4 are strong, cheap and _testable_. A rule that reads a printed page
  number off the running header is exactly reproducible; a model asked the same question
  is not.
- A 374-page book is far past a sane context window. Sending it would be slow, costly, and
  would still hallucinate boundaries.
- The 100% target for VGR books is only reachable with deterministic rules over verified
  invariants.

Where AI genuinely helps is the small, ambiguous, _low-volume_ decisions:

- Is this centred line a chapter title or an emphasised sentence?
- Where does front matter end and chapter 1 begin?
- Is this line a running header or body text?

Those questions are answered from **candidates only** — a few hundred short lines
(headings, first/last lines per page, TOC entries), never body prose. Budget: **≤ 32 KB**
of prompt per document regardless of length.

**The AI pass is optional, off by default, and reuses the existing provider system**
(`ai.repository` settings, `provider-resolver`, the configured OpenRouter/OpenAI/etc.
credentials). It must not introduce a second key path, a hardcoded key, or a new provider
abstraction. If no provider is configured, or the call fails, or it returns anything that
contradicts the deterministic pass, the deterministic result stands.

### 5.2 Detection: is this a book?

Runs after text extraction, scoring structural signals. Never filename or title matching.

| Signal                                                                            | Weight       |
| --------------------------------------------------------------------------------- | ------------ |
| Printed page numbers recoverable on a majority of pages, monotonically increasing | high         |
| A stable running header/footer repeating across many pages                        | high         |
| Bimodal x-start distribution per page (body column + indent column)               | high         |
| Repeated heading-like pages that partition the document                           | medium       |
| A table of contents in the front matter                                           | medium       |
| Page count above a threshold                                                      | low          |
| Inline sermon-style paragraph numbering                                           | **negative** |

A document is treated as a book only above a confidence threshold. Below it, the existing
plain path is used unchanged. The threshold must be tuned against the corpus so that the
~59 sermon PDFs score as non-books.

Detection result is recorded so the UI can show what was detected and let the user override.

### 5.3 Data model — additive, sync-safe, backward compatible

`custom_documents.content` today holds either a JSON array of paragraph strings or legacy
plain text; `parseContentToParagraphs` already branches on that. Extend it with a **versioned
object** as a third branch:

```jsonc
{
    "version": 2,
    "kind": "book",
    "paragraphs": [{ "index": 1, "text": "…", "page": 12, "chapterId": "c1", "pageParagraph": 2 }],
    "pages": [{ "index": 12, "printed": "12", "firstParagraph": 40 }],
    "chapters": [{ "id": "c1", "title": "…", "page": 9, "firstParagraph": 31, "level": 1 }],
    "detection": {
        "confidence": 0.97,
        "signals": ["running-header", "indent-bimodal"],
        "aiAssisted": false,
    },
}
```

Why in `content` rather than new tables:

- `custom_documents` is **synced**. Structure travels with the document for free; separate
  tables would need their own sync wiring or would be lost on another device.
- No migration, no backfill. v1 arrays and legacy text keep working untouched.
- Structure is only ever read together with content, so there is nothing to gain by
  splitting it.

One additive schema change is justified: a nullable `kind` column on `custom_documents`, so
the sidebar and document list can distinguish a book without loading and parsing content
(`getCustomDocuments` deliberately does not select `content`). `NULL` means plain — the
existing behaviour — so no backfill is required.

### 5.4 Citations

Sermons: `paragraph N`. Books: `page N, paragraph M`, where `M` is the paragraph ordinal
**within that page**, matching how a reader counts from the printed page.

Both `paragraphs[].index` (document-wide, stable, used for scroll/TTS/highlight anchoring)
and `pageParagraph` (per-page, used for display and citation) are stored. Existing
highlight, note-reference and reading-position code keys off the document-wide index and
must keep working unchanged.

The `wmb://` link scheme gains a book form; the resolver must round-trip it.

### 5.5 Renderer

A dedicated `BookDocumentView`, selected by `kind`, next to `SermonDocumentView` and
`CustomDocumentView`. It **must not** fork the reader — every existing capability is
retained by reusing the same building blocks:

Reuse, do not reimplement: `DocumentBody`, `ParagraphList` / `TtsParagraph`, `useTts`,
`useDocumentHighlights`, `useSearchHighlight`, `useMatchNavigation`, `useScrollAndZoom`,
`useContextMenuItems`, `useReferenceNavigation`, `DocumentHeaderTitle`, `ReadingModeToggle`,
`ZoomControls`, `TtsButton`, `HighlightedText`.

Added on top:

- Page break markers in the flow, showing the printed page number
- A chapter navigator (replacing the paragraph-only navigator when structure exists)
- Citation display of `page · paragraph` on selection and in the context menu
- Optional per-page-paragraph numbering in the gutter

TTS, highlighting, search, zoom, reading position and PDF export must behave identically to
a plain custom document.

## 6. Non-negotiables

1. **No per-book special cases.** No title, filename or publisher branching anywhere.
2. **No duplication.** Before writing a helper, search for an existing one — `searchable.ts`,
   `pdf-extract.service.ts`, `document-import.service.ts`, `highlighted-text.tsx`,
   `document-view/hooks/`. Extend rather than fork. Duplication found in review is a defect.
3. **Graceful degradation.** Low confidence ⇒ today's behaviour, never a broken book.
4. **Language neutral.** No language-specific word lists for chapter detection. Structural
   signals and Unicode properties only.
5. **Offline-capable.** Full structural import with no network.
6. **Existing data untouched.** v1 documents keep rendering exactly as now.
7. **No comment noise.** Comments explain _why_, never restate the code.

## 7. Acceptance criteria

- EN `ages` and FR `expose`: ≥99% of paragraphs carry the correct printed page; every
  chapter start detected; front matter excluded from chapter 1; no header/footer text and
  no mojibake in any paragraph body.
- The ~59 sermon PDFs: **zero** classified as books.
- A synthetic corpus covering Latin / Cyrillic / Greek / CJK / RTL parses without crashing
  and without mis-detecting.
- v1 and legacy documents render byte-identically to before.
- Import of a 400-page book completes in reasonable time and memory on the main process
  without blocking the UI.
- TTS, highlights, search, notes, reading position and export work on a book document.
- Typecheck, lint, prettier clean. New unit tests for detection, extraction and the
  content-model round-trip.

## 8. Test strategy

- **Fixtures.** Structural fixtures committed as small JSON (extracted layout metrics), not
  the copyrighted PDFs. Full PDFs stay local, referenced by the download script in §10.
- **Golden tests.** For each book, a checked-in expectation of chapter starts and a sample
  of `(paragraph → page)` mappings, verified against the printed edition.
- **Negative tests.** Every sermon PDF must score below the book threshold.
- **Property tests.** Page numbers monotonic; every paragraph belongs to exactly one page
  and at most one chapter; paragraph indices contiguous from 1.
- **Regression.** Existing custom-document tests must pass untouched.

## 9. Risks

| Risk                                                     | Mitigation                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Broken font encodings (§4.3)                             | Detect unusable runs, exclude, never guess the offset                   |
| Printed number ≠ PDF index (roman front matter, offsets) | Always read from the page; never compute                                |
| Multi-column layouts                                     | x-clustering must detect column count and bail to plain if >1           |
| Very large books blocking the main process               | Stream per page; chunk; measure                                         |
| AI pass contradicting structure                          | Deterministic result always wins                                        |
| Over-fitting to the two `ages` books                     | Corpus must include third-party books; ≥95% target is on _unseen_ books |

## 10. Corpus

Not committed — downloaded on demand by `scripts/fetch-book-corpus.sh` into `tmp/corpus`,
which `.gitignore` already covers. Every download is verified by content (magic bytes,
size, page count), because a dead path on these hosts answers with a styled error page
that `curl -f` accepts.

- EN book: `en.branham.ru/files/books/BK-AGES An Exposition Of The Seven Church Ages VGR.pdf`
- FR book: `branham.fr/files/books/expose.zip`
- Sermon negatives: `en.branham.ru/files/books/{7seals,COD,Hebrews,Daniel,Revelation,adoption,Israel_and_the_Church}.zip` — 73 PDFs
- Third-party, public domain, 29 files under `tmp/corpus/third-party`:
    - **CTAN** `lshort` and its translations — LaTeX, flush-left numbered headings, roman
      front matter. en, de, fr, es, it, pt, tr, vi, ru, ko, zh, fa, th.
    - **Internet Archive** scans with an OCR text layer — Moby-Dick, Walden,
      Pride and Prejudice (two volumes in one file), Les Misérables vol. III.
    - **Wikisource** PDF exports — Greek, Cyrillic, Han, Kana, Arabic, Hebrew, Latin.
    - **Project Gutenberg** EPUB — en, ru, zh, for the outline-only import path.
