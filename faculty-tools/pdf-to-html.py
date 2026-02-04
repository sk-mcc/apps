import streamlit as st
import fitz  # PyMuPDF
from collections import Counter
import html
import re

st.set_page_config(page_title="PDF to Accessible HTML", page_icon="📄", layout="wide")

# Custom CSS for clean, professional look with dark mode support
st.markdown("""
<style>
    .main-header {
        font-size: 2rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 0.5rem;
    }
    .subtitle {
        font-size: 1rem;
        color: #64748b;
        margin-bottom: 2rem;
    }
    .instruction-box {
        background-color: #f1f5f9;
        border-left: 4px solid #3b82f6;
        padding: 1.5rem;
        margin: 1rem 0;
        border-radius: 0.5rem;
        color: #1e293b;
        line-height: 1.8;
    }
    .instruction-box strong {
        color: #0f172a;
    }
    .instruction-box ul, .instruction-box ol {
        color: #334155;
        margin: 0.75rem 0;
    }
    .instruction-box li {
        margin: 0.5rem 0;
    }
    .step-number {
        display: inline-block;
        background-color: #3b82f6;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        text-align: center;
        line-height: 28px;
        font-weight: 600;
        margin-right: 0.75rem;
        flex-shrink: 0;
    }
    .step-line {
        display: flex;
        align-items: center;
        margin: 0.75rem 0;
    }
    .text-preview {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
        font-family: 'Georgia', serif;
        color: #1e293b;
    }
    .text-preview small {
        color: #64748b;
    }

    /* Dark mode styles */
    @media (prefers-color-scheme: dark) {
        .main-header {
            color: #f1f5f9;
        }
        .subtitle {
            color: #cbd5e1;
        }
        .instruction-box {
            background-color: #1e293b;
            border-left: 4px solid #60a5fa;
            color: #e2e8f0;
        }
        .instruction-box strong {
            color: #f1f5f9;
        }
        .instruction-box ul, .instruction-box ol {
            color: #cbd5e1;
        }
        .text-preview {
            background-color: #1e293b;
            border: 1px solid #475569;
            color: #e2e8f0;
        }
        .text-preview small {
            color: #94a3b8;
        }
    }

    .tag-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        margin-right: 0.5rem;
    }
    .tag-h1 { background-color: #dbeafe; color: #1e40af; }
    .tag-h2 { background-color: #e0e7ff; color: #4338ca; }
    .tag-h3 { background-color: #ede9fe; color: #6d28d9; }
    .tag-body { background-color: #f1f5f9; color: #475569; }
    .stButton button {
        border-radius: 0.5rem;
        font-weight: 500;
    }
    div[data-testid="stButton"] button[kind="primary"] {
        background-color: #0891b2;
        color: white;
    }
    div[data-testid="stButton"] button[kind="primary"]:hover {
        background-color: #0e7490;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'pdf_uploaded' not in st.session_state:
    st.session_state.pdf_uploaded = False
if 'text_elements' not in st.session_state:
    st.session_state.text_elements = []
if 'document_title' not in st.session_state:
    st.session_state.document_title = "Untitled Document"


def merge_consecutive_lines(lines, body_font_size=None):
    """Merge consecutive lines that appear to be part of the same block (e.g., multi-line headings)"""
    if not lines:
        return lines

    # If we don't know body size yet, estimate it as the most common size
    if body_font_size is None:
        size_counts = Counter()
        for line in lines:
            rounded = round(line['font_size'] * 2) / 2
            size_counts[rounded] += line['char_count']
        body_font_size = size_counts.most_common(1)[0][0] if size_counts else 12

    merged = []
    current = None

    for line in lines:
        if current is None:
            current = line.copy()
            continue

        # Check if this line should merge with the previous one
        same_page = line['page'] == current['page']

        # Is this likely a heading? (larger than body text)
        avg_size = (current['font_size'] + line['font_size']) / 2
        is_heading_sized = min(current['font_size'], line['font_size']) > body_font_size + 0.5

        # For font size comparison - very lenient for headings (small caps vary a lot)
        if is_heading_sized:
            similar_size = abs(line['font_size'] - current['font_size']) < 5.0  # 5pt tolerance for headings
        else:
            similar_size = abs(line['font_size'] - current['font_size']) < 2.0

        # Check vertical proximity - be more generous for larger text (headings)
        max_gap = avg_size * 3.0  # Allow up to 3x font size gap
        y_gap = line['y_position'] - current['y_position']
        close_vertically = 0 < y_gap < max_gap

        # For headings, be more aggressive about merging
        # For body text, require both lines to be short
        if is_heading_sized:
            # Headings: merge if same page and close vertically (very lenient on size)
            should_merge = same_page and similar_size and close_vertically
        else:
            # Body text: only merge short lines with same formatting
            both_short = current['char_count'] < 80 and line['char_count'] < 80
            same_formatting = line['bold'] == current['bold']
            should_merge = same_page and similar_size and close_vertically and both_short and same_formatting

        if should_merge:
            # Merge: append text with space
            current['text'] = current['text'] + ' ' + line['text']
            current['char_count'] = len(current['text'])
            # Keep the larger font size
            current['font_size'] = max(current['font_size'], line['font_size'])
            # Preserve bold if either line is bold
            current['bold'] = current['bold'] or line['bold']
        else:
            # Don't merge, save current and start new
            merged.append(current)
            current = line.copy()

    # Don't forget the last one
    if current:
        merged.append(current)

    return merged


def merge_consecutive_headings(elements):
    """Second pass: merge consecutive heading elements that should be together"""
    if not elements:
        return elements

    merged = []
    current = None

    for elem in elements:
        if current is None:
            current = elem.copy()
            continue

        # Only consider merging if both are headings
        current_is_heading = current['user_tag'] in ['H1', 'H2', 'H3']
        elem_is_heading = elem['user_tag'] in ['H1', 'H2', 'H3']

        if current_is_heading and elem_is_heading:
            same_page = elem['page'] == current['page']
            # Check if they're close in heading level (H1+H2 can merge, but not H1+H3)
            level_diff = abs(int(current['user_tag'][1]) - int(elem['user_tag'][1]))
            close_level = level_diff <= 1

            if same_page and close_level:
                # Merge them
                current['text'] = current['text'] + ' ' + elem['text']
                current['char_count'] = len(current['text'])
                current['font_size'] = max(current['font_size'], elem['font_size'])
                # Keep the higher heading level (H1 > H2 > H3)
                if int(elem['user_tag'][1]) < int(current['user_tag'][1]):
                    current['user_tag'] = elem['user_tag']
                    current['suggested_tag'] = elem['suggested_tag']
                continue

        # Don't merge
        merged.append(current)
        current = elem.copy()

    if current:
        merged.append(current)

    return merged


def normalize_text_for_comparison(text):
    """Normalize text for comparing running headers (ignore numbers, case)"""
    # Replace all digits with #
    normalized = re.sub(r'\d+', '#', text.lower())
    # Remove extra whitespace
    normalized = ' '.join(normalized.split())
    return normalized


def analyze_pdf_structure(pdf_bytes):
    """Extract text from PDF with font metadata"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    raw_lines = []
    page_heights = {}

    # First pass: collect all lines
    for page_num, page in enumerate(doc):
        page_heights[page_num + 1] = page.rect.height
        blocks = page.get_text("dict")["blocks"]

        for block in blocks:
            if block["type"] == 0:  # Text block
                for line in block["lines"]:
                    line_text = " ".join(span["text"] for span in line["spans"]).strip()

                    if line_text and len(line_text) > 1:
                        max_font_size = max(span["size"] for span in line["spans"])
                        fonts = [span["font"] for span in line["spans"]]
                        is_bold = any("Bold" in font or "bold" in font for font in fonts)
                        is_italic = any("Italic" in font or "Oblique" in font for font in fonts)
                        y_position = line["bbox"][1]  # Top of line

                        raw_lines.append({
                            'page': page_num + 1,
                            'text': line_text,
                            'font_size': max_font_size,
                            'bold': is_bold,
                            'italic': is_italic,
                            'char_count': len(line_text),
                            'y_position': y_position,
                            'page_height': page.rect.height,
                            'suggested_tag': None,
                            'user_tag': None
                        })

    doc.close()

    # Merge consecutive lines that are part of the same heading/block
    all_lines = merge_consecutive_lines(raw_lines)

    # Track text that appears on multiple pages (likely headers/footers)
    text_page_counts = Counter()
    for elem in all_lines:
        text_page_counts[elem['text']] += 1

    # Track normalized text patterns (catches "WRITING SPACES 4", "WRITING SPACES 5", etc.)
    normalized_page_counts = Counter()
    for elem in all_lines:
        normalized = normalize_text_for_comparison(elem['text'])
        normalized_page_counts[normalized] += 1

    # Track text in header/footer zones (top 72pt or bottom 72pt)
    header_footer_patterns = set()
    for elem in all_lines:
        page_height = elem.get('page_height', 792)  # Default letter size
        in_header_zone = elem['y_position'] < 72
        in_footer_zone = elem['y_position'] > page_height - 72

        if in_header_zone or in_footer_zone:
            normalized = normalize_text_for_comparison(elem['text'])
            # If this pattern appears in header/footer zone on 2+ pages, mark it
            if normalized_page_counts[normalized] >= 2:
                header_footer_patterns.add(normalized)

    # Filter out likely headers/footers and noise
    total_pages = max(e['page'] for e in all_lines) if all_lines else 1
    repeated_threshold = min(3, total_pages)

    elements = []
    for elem in all_lines:
        text = elem['text']

        # Skip if it appears on multiple pages (header/footer)
        if text_page_counts[text] >= repeated_threshold:
            continue

        # Skip running headers/footers (same text pattern with varying page numbers)
        normalized = normalize_text_for_comparison(text)
        if normalized in header_footer_patterns:
            continue

        # Skip standalone page numbers and short numeric patterns
        stripped = text.strip('.-–— ·•')
        # Pure digits
        if stripped.isdigit() and len(stripped) < 5:
            continue
        # Roman numerals (common for front matter)
        if stripped.lower() in ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
                                 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx']:
            continue
        # "Page X" or "X of Y" patterns
        if text.lower().startswith('page ') and len(text) < 15:
            continue
        if ' of ' in text.lower() and len(text) < 15 and any(c.isdigit() for c in text):
            continue

        # Skip very short fragments (likely artifacts)
        if len(text) < 3:
            continue

        elements.append(elem)

    return elements


def detect_heading_hierarchy(elements):
    """Analyze font sizes to determine heading hierarchy"""
    if not elements:
        return elements

    # Count font sizes (rounded to nearest 1pt for grouping to avoid tiny variations)
    size_counts = Counter()
    for elem in elements:
        rounded_size = round(elem['font_size'])
        size_counts[rounded_size] += elem['char_count']

    # Find body text size (most common by character count)
    body_size = size_counts.most_common(1)[0][0] if size_counts else 12

    # Get unique sizes significantly larger than body text (at least 2pt bigger)
    larger_sizes = sorted([s for s in size_counts.keys() if s > body_size + 1.5], reverse=True)

    # Cluster sizes that are within 2pt of each other (same heading level)
    clustered_sizes = []
    for size in larger_sizes:
        # Check if this size fits in an existing cluster
        fits_cluster = False
        for cluster in clustered_sizes:
            if abs(size - cluster[0]) <= 2:
                cluster.append(size)
                fits_cluster = True
                break
        if not fits_cluster:
            clustered_sizes.append([size])

    # Map each cluster to a heading level (use the max size in cluster as representative)
    size_to_heading = {}
    for i, cluster in enumerate(clustered_sizes[:3]):  # Max H1, H2, H3
        for size in cluster:
            size_to_heading[size] = f'H{i + 1}'

    # Assign tags to elements
    for elem in elements:
        rounded_size = round(elem['font_size'])
        char_count = elem['char_count']

        # Long text is always body (paragraphs)
        if char_count > 200:
            elem['suggested_tag'] = 'Body Text'
        # Italic-only short text is likely author byline, not a heading
        elif elem['italic'] and not elem['bold'] and char_count < 50:
            elem['suggested_tag'] = 'Body Text'
        # Check if it matches a heading size
        elif rounded_size in size_to_heading:
            # But still require it to be reasonably short
            if char_count < 150:
                elem['suggested_tag'] = size_to_heading[rounded_size]
            else:
                elem['suggested_tag'] = 'Body Text'
        # Short bold text at body size might be a subheading
        elif elem['bold'] and char_count < 80:
            elem['suggested_tag'] = 'H3'
        else:
            elem['suggested_tag'] = 'Body Text'

        elem['user_tag'] = elem['suggested_tag']

    return elements


def get_headings_only(elements):
    """Return only elements tagged as headings"""
    return [e for e in elements if e['user_tag'] in ['H1', 'H2', 'H3']]


def get_body_text_sample(elements, max_items=5):
    """Return a sample of body text elements for 'promote to heading' feature"""
    body = [e for e in elements if e['user_tag'] == 'Body Text' and e['char_count'] < 100]
    return body[:max_items]


def normalize_heading_hierarchy(elements):
    """Ensure heading levels don't skip (H1 -> H3 becomes H1 -> H2 for accessibility)"""
    if not elements:
        return elements

    # Find all heading levels actually used in the document (H1-H6)
    levels_used = set()
    for elem in elements:
        tag = elem['user_tag']
        if tag and len(tag) >= 2 and tag[0] == 'H' and tag[1:].isdigit():
            levels_used.add(int(tag[1:]))

    if not levels_used:
        return elements

    # Create a mapping from old levels to new sequential levels
    # e.g., if document has H1, H3, H4 -> map {1: 1, 3: 2, 4: 3}
    sorted_levels = sorted(levels_used)
    level_map = {}
    for new_level, old_level in enumerate(sorted_levels, start=1):
        level_map[old_level] = new_level

    # Apply the mapping to all headings
    for elem in elements:
        tag = elem['user_tag']
        if tag and len(tag) >= 2 and tag[0] == 'H' and tag[1:].isdigit():
            old_level = int(tag[1:])
            if old_level in level_map:
                new_level = level_map[old_level]
                elem['user_tag'] = f'H{new_level}'
                elem['suggested_tag'] = elem['user_tag']

    return elements


def generate_standalone_html(elements, title):
    """Generate a complete HTML document with embedded CSS"""
    css = """
        * {
            box-sizing: border-box;
        }
        body {
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.7;
            color: #1a1a1a;
            background-color: #ffffff;
            margin: 0;
            padding: 2rem;
        }
        main {
            max-width: 45rem;
            margin: 0 auto;
        }
        h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #0f172a;
            margin: 2rem 0 1rem 0;
            line-height: 1.3;
        }
        h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1e293b;
            margin: 1.75rem 0 0.75rem 0;
            line-height: 1.4;
        }
        h3 {
            font-size: 1.25rem;
            font-weight: 600;
            color: #334155;
            margin: 1.5rem 0 0.5rem 0;
            line-height: 1.4;
        }
        p {
            margin: 0 0 1rem 0;
        }
        /* First heading should have no top margin */
        main > h1:first-child,
        main > h2:first-child,
        main > h3:first-child {
            margin-top: 0;
        }
        /* Accessibility: focus styles */
        a:focus {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
        }
        /* Responsive adjustments */
        @media (max-width: 600px) {
            body {
                padding: 1rem;
            }
            h1 {
                font-size: 1.75rem;
            }
            h2 {
                font-size: 1.35rem;
            }
            h3 {
                font-size: 1.15rem;
            }
        }
    """

    html_parts = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        f'    <title>{html.escape(title)}</title>',
        '    <style>',
        css,
        '    </style>',
        '</head>',
        '<body>',
        '    <main>'
    ]

    # Group consecutive body text into paragraphs, detecting breaks via vertical gaps
    current_paragraph = []
    last_body_elem = None

    for elem in elements:
        tag = elem['user_tag']
        text = html.escape(elem['text'])

        if tag == 'Body Text':
            # Check if this is a new paragraph (large vertical gap from previous line)
            if last_body_elem is not None and current_paragraph:
                y_gap = elem['y_position'] - last_body_elem['y_position']
                line_height = last_body_elem['font_size'] * 1.5  # Typical line spacing
                # If gap is more than 2x normal line height, it's a new paragraph
                if y_gap > line_height * 2 or elem['page'] != last_body_elem['page']:
                    # Flush current paragraph
                    html_parts.append(f'        <p>{" ".join(current_paragraph)}</p>')
                    current_paragraph = []

            current_paragraph.append(text)
            last_body_elem = elem
        else:
            # Flush paragraph if we have one
            if current_paragraph:
                html_parts.append(f'        <p>{" ".join(current_paragraph)}</p>')
                current_paragraph = []
                last_body_elem = None
                current_paragraph = []

            # Add heading
            if tag == 'H1':
                html_parts.append(f'        <h1>{text}</h1>')
            elif tag == 'H2':
                html_parts.append(f'        <h2>{text}</h2>')
            elif tag == 'H3':
                html_parts.append(f'        <h3>{text}</h3>')

    # Flush any remaining paragraph
    if current_paragraph:
        html_parts.append(f'        <p>{" ".join(current_paragraph)}</p>')

    html_parts.extend([
        '    </main>',
        '</body>',
        '</html>'
    ])

    return '\n'.join(html_parts)


def generate_canvas_html(elements):
    """Generate Canvas-compatible HTML (headers start at H2)"""
    html_parts = []
    current_paragraph = []
    last_body_elem = None

    # Map heading levels down by one (H1->H2, H2->H3, H3->H4)
    tag_map = {
        'H1': 'h2',
        'H2': 'h3',
        'H3': 'h4',
        'Body Text': 'p'
    }

    for elem in elements:
        tag = elem['user_tag']
        text = html.escape(elem['text'])

        if tag == 'Body Text':
            # Check if this is a new paragraph (large vertical gap from previous line)
            if last_body_elem is not None and current_paragraph:
                y_gap = elem['y_position'] - last_body_elem['y_position']
                line_height = last_body_elem['font_size'] * 1.5
                if y_gap > line_height * 2 or elem['page'] != last_body_elem['page']:
                    html_parts.append(f'<p>{" ".join(current_paragraph)}</p>')
                    current_paragraph = []

            current_paragraph.append(text)
            last_body_elem = elem
        else:
            # Flush paragraph if we have one
            if current_paragraph:
                html_parts.append(f'<p>{" ".join(current_paragraph)}</p>')
                current_paragraph = []
                last_body_elem = None

            # Add heading (shifted down one level)
            html_tag = tag_map.get(tag, 'p')
            html_parts.append(f'<{html_tag}>{text}</{html_tag}>')

    # Flush any remaining paragraph
    if current_paragraph:
        html_parts.append(f'<p>{" ".join(current_paragraph)}</p>')

    return '\n'.join(html_parts)


# Header
st.markdown('<div class="main-header">PDF to Accessible HTML</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Convert PDF documents to accessible, well-structured HTML for the web or Canvas LMS</div>', unsafe_allow_html=True)

# Instructions
with st.expander("How to Use This Tool", expanded=(not st.session_state.pdf_uploaded)):
    st.markdown("""
    <div class="instruction-box">
    <strong>This tool converts PDF text to accessible HTML:</strong>
    <ul>
        <li>Automatically detects headings based on font size</li>
        <li>Lets you review and adjust the detected structure</li>
        <li>Exports as standalone HTML or Canvas-compatible HTML</li>
    </ul>

    <strong>The Process:</strong><br><br>

    <div class="step-line">
        <span class="step-number">1</span>
        <span>Upload your PDF file</span>
    </div>

    <div class="step-line">
        <span class="step-number">2</span>
        <span>Review the detected heading structure</span>
    </div>

    <div class="step-line">
        <span class="step-number">3</span>
        <span>Choose your export format and download</span>
    </div>

    <strong>Export Formats:</strong>
    <ul>
        <li><strong>Standalone HTML:</strong> Complete webpage with styling - good for sharing or hosting</li>
        <li><strong>Canvas HTML:</strong> Simple HTML for pasting into Canvas LMS (headers start at H2)</li>
    </ul>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

# Step 1: Upload
st.markdown("### Step 1: Upload Your PDF")
st.markdown("Select a PDF file. Works best with text-based PDFs (not scanned images).")

uploaded_file = st.file_uploader(
    "Choose a PDF file",
    type=['pdf'],
    help="Upload the PDF you want to convert to HTML"
)

if uploaded_file:
    if not st.session_state.pdf_uploaded:
        with st.spinner("Analyzing PDF structure..."):
            pdf_bytes = uploaded_file.read()
            st.session_state.pdf_bytes = pdf_bytes

            # Extract and analyze
            elements = analyze_pdf_structure(pdf_bytes)
            elements = detect_heading_hierarchy(elements)
            # Second pass: merge consecutive headings that got split
            elements = merge_consecutive_headings(elements)
            # Re-detect hierarchy after merging (font size tiers may have changed)
            elements = detect_heading_hierarchy(elements)
            # Final pass: ensure no heading levels are skipped (accessibility)
            elements = normalize_heading_hierarchy(elements)
            st.session_state.text_elements = elements

            # Try to detect title from first H1
            for elem in elements:
                if elem['user_tag'] == 'H1':
                    st.session_state.document_title = elem['text'][:100]
                    break
            else:
                st.session_state.document_title = uploaded_file.name.replace('.pdf', '')

            st.session_state.pdf_uploaded = True
        st.rerun()

# Step 2: Review and Edit Tags
if st.session_state.pdf_uploaded and st.session_state.text_elements:
    st.markdown("---")
    st.markdown("### Step 2: Review Document Structure")

    # Document title input
    st.session_state.document_title = st.text_input(
        "Document Title",
        value=st.session_state.document_title,
        help="Used as the page title in standalone HTML export"
    )

    # Get headings for review
    headings = get_headings_only(st.session_state.text_elements)

    # Summary
    h1_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H1')
    h2_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H2')
    h3_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H3')

    st.markdown(f"**Detected {len(headings)} headings** ({h1_count} H1, {h2_count} H2, {h3_count} H3)")

    if headings:
        st.markdown("#### Document Outline")
        st.caption("Review detected headings. Change the level or set to 'Body Text' to remove from outline.")

        for idx, elem in enumerate(headings):
            original_idx = st.session_state.text_elements.index(elem)

            # Indent based on heading level for visual hierarchy
            indent = ""
            if elem['user_tag'] == 'H2':
                indent = "&nbsp;&nbsp;&nbsp;&nbsp;"
            elif elem['user_tag'] == 'H3':
                indent = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"

            col1, col2 = st.columns([4, 1])

            with col1:
                display_text = elem['text'][:80] + ('...' if len(elem['text']) > 80 else '')
                st.markdown(f"{indent}**{html.escape(display_text)}** <small style='color:#64748b;'>p.{elem['page']}</small>", unsafe_allow_html=True)

            with col2:
                new_tag = st.selectbox(
                    "Level",
                    ["H1", "H2", "H3", "Body Text"],
                    index=["H1", "H2", "H3", "Body Text"].index(elem['user_tag']),
                    key=f"tag_{original_idx}",
                    label_visibility="collapsed"
                )
                st.session_state.text_elements[original_idx]['user_tag'] = new_tag
    else:
        st.warning("No headings detected. The document may not have text larger than body size.")

    # Option to promote missed headings
    with st.expander("Missed a heading? Promote text to heading"):
        st.caption("If an important heading wasn't detected, you can promote it here.")

        # Show short body text that might be headings
        body_candidates = [e for e in st.session_state.text_elements
                          if e['user_tag'] == 'Body Text' and 10 < e['char_count'] < 100]

        if body_candidates:
            for idx, elem in enumerate(body_candidates[:15]):  # Show up to 15 candidates
                original_idx = st.session_state.text_elements.index(elem)

                col1, col2 = st.columns([4, 1])

                with col1:
                    st.markdown(f"<small style='color:#64748b;'>p.{elem['page']}</small> {html.escape(elem['text'][:60])}", unsafe_allow_html=True)

                with col2:
                    if st.button("→ H2", key=f"promote_{original_idx}"):
                        st.session_state.text_elements[original_idx]['user_tag'] = 'H2'
                        st.rerun()
        else:
            st.caption("No short text segments found to promote.")

    st.markdown("---")

    # Step 3: Export
    st.markdown("### Step 3: Export HTML")

    export_format = st.radio(
        "Export Format:",
        ["Standalone HTML (with CSS)", "Canvas HTML (headers start at H2)"],
        horizontal=True,
        help="Standalone: complete webpage. Canvas: simple HTML for LMS."
    )

    col1, col2, col3 = st.columns([2, 2, 2])

    with col1:
        if st.button("Generate HTML", type="primary", use_container_width=True):
            with st.spinner("Generating HTML..."):
                if "Standalone" in export_format:
                    output_html = generate_standalone_html(
                        st.session_state.text_elements,
                        st.session_state.document_title
                    )
                    st.session_state.output_html = output_html
                    st.session_state.output_filename = "accessible_document.html"
                else:
                    output_html = generate_canvas_html(st.session_state.text_elements)
                    st.session_state.output_html = output_html
                    st.session_state.output_filename = "canvas_content.html"

                st.success("HTML generated!")

    with col2:
        if 'output_html' in st.session_state:
            st.download_button(
                label="Download HTML",
                data=st.session_state.output_html,
                file_name=st.session_state.output_filename,
                mime="text/html",
                use_container_width=True
            )

    with col3:
        if st.button("Start Over", use_container_width=True):
            for key in ['pdf_uploaded', 'text_elements', 'pdf_bytes', 'output_html',
                       'output_filename', 'document_title']:
                if key in st.session_state:
                    del st.session_state[key]
            st.rerun()

    # Preview
    if 'output_html' in st.session_state:
        with st.expander("Preview HTML Output", expanded=False):
            st.code(st.session_state.output_html, language="html")

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #64748b; font-size: 0.875rem;'>
    <strong>Note:</strong> This tool works best with text-based PDFs.
    Scanned documents may need OCR processing first.
</div>
""", unsafe_allow_html=True)
