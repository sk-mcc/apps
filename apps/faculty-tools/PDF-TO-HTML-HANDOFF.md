# PDF to Accessible HTML - Handoff Document

## Overview
A Streamlit tool that converts PDFs to accessible HTML, with two export formats:
- **Standalone HTML**: Complete webpage with embedded CSS
- **Canvas HTML**: Simple HTML for LMS (headers start at H2)

## Current Status: Partially Working

### What's Working
1. **PDF text extraction** with font metadata (size, bold, italic)
2. **Heading detection** based on font size clustering
3. **Heading normalization** - ensures no skipped levels (H1→H3 becomes H1→H2)
4. **Running header/footer filtering** - removes repeated text at top/bottom of pages
5. **Page number filtering** - removes standalone numbers, roman numerals, "Page X" patterns
6. **Basic HTML generation** with proper heading hierarchy
7. **Review UI** - shows document outline, allows adjusting heading levels

### What's NOT Working / Needs Fixing

#### 1. Lists Not Being Detected Properly
**Problem**: Bulleted and numbered lists from the PDF are not being preserved as lists in the HTML output.

**Symptoms**:
- List items get fragmented into separate paragraphs
- Multi-line list items get split
- Numbered lists show "1." repeatedly instead of 1, 2, 3, 4

**Root Cause**: The PDF stores each visual line separately. A list item that spans 3 lines in the PDF becomes 3 separate elements. The current joining logic isn't handling this well.

**Files/Functions involved**:
- `join_body_text_lines()` - attempts to join continuation lines
- `detect_list_type()` - detects list markers (•, 1., etc.)
- The HTML generation functions have list handling but it's not working correctly

**What needs to happen**:
- List items need to be joined with their continuation lines BEFORE list detection
- The PDF in testing has numbered items all as "1." (the PDF itself may use "1." for all items as a formatting choice, or the extraction is wrong)
- Need to handle nested lists (• main item, ○ sub-item)

#### 2. Paragraph Joining Issues
**Problem**: Sentences that span page breaks or multiple lines are being split into separate paragraphs.

**Symptoms**:
- Mid-sentence breaks creating multiple short paragraphs
- Words split by hyphens at line breaks not being rejoined properly

**Files/Functions involved**:
- `should_join_lines()` - determines if two lines should be joined
- `should_join_across_page_break()` - simpler check for page breaks
- `join_body_text_lines()` - does the actual joining

#### 3. Formatting (Italics/Bold) Partially Working
**Current state**:
- Span-level formatting is being extracted (`formatted_spans` in each element)
- `format_text_with_spans()` converts to `<em>` and `<strong>` tags
- But may not be working correctly in all cases

#### 4. Images/Figures - Not Implemented
The user mentioned this needs to be addressed eventually but deprioritized it.

## Code Structure

### Key Files
- `/home/skarlis/faculty-tools-github/apps/faculty-tools/pdf-to-html.py` - Main app

### Key Functions

**Extraction:**
- `analyze_pdf_structure(pdf_bytes)` - Extracts text with metadata from PDF
- `merge_consecutive_lines(lines)` - Joins multi-line headings

**Heading Detection:**
- `detect_heading_hierarchy(elements)` - Assigns H1/H2/H3 based on font sizes
- `merge_consecutive_headings(elements)` - Joins split headings
- `normalize_heading_hierarchy(elements)` - Fixes skipped levels

**Filtering:**
- `normalize_text_for_comparison()` - For detecting repeated headers/footers
- Various filters for page numbers, running headers

**HTML Generation:**
- `join_body_text_lines(elements)` - Pre-joins continuation lines
- `detect_list_type(text)` - Identifies list markers
- `format_text_with_spans(spans)` - Adds `<em>`/`<strong>` tags
- `generate_standalone_html(elements, title)` - Full HTML with CSS
- `generate_canvas_html(elements)` - Simple HTML, headers shifted down

## Test PDF
The user has been testing with a PDF called "Writing Spaces" that contains:
- Small caps title spanning multiple lines
- Author name in italics
- Section headings like "Inter-What?", "Overview"
- Bulleted lists with • markers
- Nested sub-lists with ○ markers
- Numbered discussion questions at the end
- Italicized terms within paragraphs

## Next Steps (Priority Order)

1. **Fix list detection and joining**
   - Debug why list items aren't staying together
   - Handle multi-line list items properly
   - Fix numbered list detection (all showing as "1.")
   - Handle nested lists (• and ○)

2. **Fix paragraph joining**
   - Ensure sentences spanning pages get joined
   - Handle hyphenated word breaks

3. **Verify formatting output**
   - Test that italics/bold are appearing in final HTML

4. **Eventually: Handle images/figures**

## Git History (Recent Commits)
```
0368d69 Fix NameError: restore should_join_across_page_break function
b883240 Add line joining for body text before HTML generation
1787888 Add formatting, lists, and page break handling
5e5dc50 Rewrite normalization to shift all headings when skip detected
... (many commits related to heading detection and normalization)
47c4f9f Add PDF to Accessible HTML converter tool (initial)
```

## Related Files
- `/home/skarlis/faculty-tools-github/apps/faculty-tools/pdf-accessibility.py` - Original tool this was based on
- `/home/skarlis/faculty-tools-github/apps/examples/example-canvas-html.txt` - Example of Canvas HTML format
