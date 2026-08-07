#!/usr/bin/env bash
#
# Downloads the book-import test corpus. Nothing here is committed: the VGR books
# are copyrighted and the third-party set is large. Unit tests run against
# checked-in structural fixtures; the corpus is only needed to re-measure accuracy.
#
#   scripts/fetch-book-corpus.sh [target-directory]
#   CORPUS_DIR=/somewhere/else scripts/fetch-book-corpus.sh
#
# Defaults to `tmp/corpus`, which .gitignore already covers, so a book file
# cannot be committed by accident. The same path is what the accuracy gate reads
# from CORPUS_DIR.
#
# Layout produced:
#   <target>/                 VGR books + sermon negatives (the original corpus)
#   <target>/third-party/     public-domain books, several publishers and scripts
#
set -euo pipefail

TARGET="${1:-${CORPUS_DIR:-tmp/corpus}}"
THIRD_PARTY="$TARGET/third-party"
BOOKS_BASE="https://en.branham.ru/files/books"
CTAN="https://mirrors.ctan.org/info/lshort"
IA="https://archive.org/download"
WS_EXPORT="https://ws-export.wmcloud.org"
USER_AGENT="wmb-table-corpus/1.0 (book import accuracy tests)"

mkdir -p "$TARGET" "$THIRD_PARTY"

# A server that answers a dead path with a styled 404 page produces a file that
# `curl -f` accepts and every later step then misreads. Everything downloaded is
# verified by content, never by exit status.
verify() {
    local destination="$1" kind="$2"
    local size
    size=$(wc -c <"$destination")
    if [ "$size" -lt 20000 ]; then
        echo "  ! ${destination##*/}: $size bytes — not a book, discarding" >&2
        rm -f "$destination"
        return 1
    fi

    case "$kind" in
        pdf)
            if [ "$(head -c 5 "$destination")" != "%PDF-" ]; then
                echo "  ! ${destination##*/}: not a PDF, discarding" >&2
                rm -f "$destination"
                return 1
            fi
            if command -v pdfinfo >/dev/null 2>&1; then
                local pages
                pages=$(pdfinfo "$destination" 2>/dev/null | awk '/^Pages:/ {print $2}')
                if [ -z "$pages" ] || [ "$pages" -lt 20 ]; then
                    echo "  ! ${destination##*/}: ${pages:-0} pages, discarding" >&2
                    rm -f "$destination"
                    return 1
                fi
                echo "  ok ${destination##*/} ($pages pages, $((size / 1024)) KB)"
                return 0
            fi
            ;;
        epub)
            if [ "$(head -c 2 "$destination")" != "PK" ]; then
                echo "  ! ${destination##*/}: not an EPUB, discarding" >&2
                rm -f "$destination"
                return 1
            fi
            ;;
    esac

    echo "  ok ${destination##*/} ($((size / 1024)) KB)"
}

fetch() {
    local url="$1" destination="$2" kind="${3:-pdf}"
    if [ -s "$destination" ]; then
        echo "have  ${destination##*/}"
        return 0
    fi
    echo "fetch ${destination##*/}"
    if ! curl -fsSL --retry 3 --retry-delay 5 --max-time 1800 \
        -A "$USER_AGENT" -o "$destination" "$url"; then
        echo "  ! ${destination##*/}: download failed" >&2
        rm -f "$destination"
        return 0
    fi
    verify "$destination" "$kind" || true
}

# Wikisource renders on demand and rejects concurrent requests, so these are
# fetched one at a time with a pause between them.
fetch_wikisource() {
    local lang="$1" page="$2" destination="$THIRD_PARTY/$3"
    [ -s "$destination" ] && {
        echo "have  ${destination##*/}"
        return 0
    }
    local encoded
    encoded=$(printf '%s' "$page" | od -An -tx1 -v | tr -d '\n ' | sed 's/../%&/g')
    fetch "$WS_EXPORT/?format=pdf&lang=$lang&page=$encoded" "$destination" pdf
    sleep 5
}

unpack() {
    local archive="$1" directory="$2"
    [ -d "$directory" ] && return
    mkdir -p "$directory"
    unzip -qo "$archive" -d "$directory"
    rm -f "$archive"
}

echo "== VGR books (positive class)"
fetch "$BOOKS_BASE/BK-AGES%20An%20Exposition%20Of%20The%20Seven%20Church%20Ages%20VGR.pdf" \
    "$TARGET/ages-en.pdf"

fetch "https://branham.fr/files/books/expose.zip" "$TARGET/expose.zip" zip
if [ -f "$TARGET/expose.zip" ]; then
    unzip -qo "$TARGET/expose.zip" -d "$TARGET"
    rm -f "$TARGET/expose.zip"
fi

echo
echo "== sermon transcripts (negative class)"
for archive in 7seals COD Hebrews Daniel Revelation adoption Israel_and_the_Church; do
    fetch "$BOOKS_BASE/$archive.zip" "$TARGET/$archive.zip" zip
    [ -f "$TARGET/$archive.zip" ] && unpack "$TARGET/$archive.zip" "$TARGET/$archive"
done

# LaTeX-typeset manuals. Different typesetter from everything else in the corpus:
# left-aligned bold sans headings, numbered sections, running headers, a real TOC.
echo
echo "== third party: LaTeX (CTAN)"
fetch "$CTAN/english/lshort.pdf" "$THIRD_PARTY/latex-en-lshort.pdf"
fetch "$CTAN/german/l2kurz.pdf" "$THIRD_PARTY/latex-de-l2kurz.pdf"
fetch "$CTAN/french/lshort-fr.pdf" "$THIRD_PARTY/latex-fr-lshort.pdf"
fetch "$CTAN/spanish/lshort-a4.pdf" "$THIRD_PARTY/latex-es-lshort.pdf"
fetch "$CTAN/italian/it-lshort.pdf" "$THIRD_PARTY/latex-it-lshort.pdf"
fetch "$CTAN/portuguese-BR/lshortBR.pdf" "$THIRD_PARTY/latex-pt-lshort.pdf"
fetch "$CTAN/turkish/lshort-tr.pdf" "$THIRD_PARTY/latex-tr-lshort.pdf"
fetch "$CTAN/polish/lshort-pl.pdf" "$THIRD_PARTY/latex-pl-lshort.pdf"
fetch "$CTAN/russian/lshortru.pdf" "$THIRD_PARTY/latex-ru-lshort.pdf"
fetch "$CTAN/chinese/lshort-zh-cn.pdf" "$THIRD_PARTY/latex-zh-lshort.pdf"
fetch "$CTAN/korean/lshort-ko.pdf" "$THIRD_PARTY/latex-ko-lshort.pdf"
fetch "$CTAN/persian/lshort.pdf" "$THIRD_PARTY/latex-fa-lshort.pdf"
fetch "$CTAN/thai/lsh132.pdf" "$THIRD_PARTY/latex-th-lshort.pdf"
fetch "$CTAN/vietnamese/lshort-vi.pdf" "$THIRD_PARTY/latex-vi-lshort.pdf"

# Scanned print editions with an OCR text layer: real publishers, real running
# heads, and the noisiest positional data the importer will ever see.
echo
echo "== third party: scanned print editions (Internet Archive)"
fetch "$IA/mobydickorwhale01melv/mobydickorwhale01melv.pdf" "$THIRD_PARTY/scan-en-mobydick.pdf"
fetch "$IA/walden00thor/walden00thor.pdf" "$THIRD_PARTY/scan-en-walden.pdf"
fetch "$IA/prideprejudice00austuoft/prideprejudice00austuoft.pdf" \
    "$THIRD_PARTY/scan-en-pride-prejudice.pdf"
fetch "$IA/lesmisrables03hugo/lesmisrables03hugo.pdf" "$THIRD_PARTY/scan-fr-miserables.pdf"

# Wikisource exports: one renderer, but the only cheap source of clean born-digital
# text in Cyrillic, Greek, Han, Kana, Devanagari, Arabic and Hebrew.
echo
echo "== third party: Wikisource exports (script coverage)"
fetch_wikisource ru "Преступление и наказание (Достоевский)" ws-ru-crime-punishment.pdf
fetch_wikisource el "Ιλιάδα" ws-el-iliad.pdf
fetch_wikisource el "Η Φόνισσα" ws-el-fonissa.pdf
fetch_wikisource zh "老殘遊記" ws-zh-laocan.pdf
fetch_wikisource ja "吾輩は猫である" ws-ja-neko.pdf
fetch_wikisource ar "كليلة ودمنة" ws-ar-kalila.pdf
fetch_wikisource he "אור הצפון/בראשית" ws-he-or-hatzafon.pdf
fetch_wikisource fr "Les Misérables" ws-fr-miserables.pdf
fetch_wikisource de "Faust - Der Tragödie erster Teil" ws-de-faust.pdf

# EPUB has no page geometry at all, so it exercises the outline path instead.
echo
echo "== third party: EPUB (outline path)"
fetch "https://www.gutenberg.org/ebooks/1342.epub3.images" "$THIRD_PARTY/epub-en-pride.epub" epub
fetch "https://www.gutenberg.org/ebooks/2554.epub3.images" "$THIRD_PARTY/epub-ru-crime.epub" epub
fetch "https://www.gutenberg.org/ebooks/25447.epub3.images" "$THIRD_PARTY/epub-zh-sanguo.epub" epub

echo
echo "corpus ready in $TARGET"
echo "  $(find "$TARGET" -maxdepth 2 -name '*.pdf' -not -path "$THIRD_PARTY/*" | wc -l) VGR/sermon PDFs"
echo "  $(find "$THIRD_PARTY" -name '*.pdf' | wc -l) third-party PDFs, $(find "$THIRD_PARTY" -name '*.epub' | wc -l) EPUBs"
