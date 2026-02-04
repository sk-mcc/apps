import streamlit as st
import fitz  # PyMuPDF
from collections import Counter
import html

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


def analyze_pdf_structure(pdf_bytes):
    """Extract text from PDF with font metadata"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    elements = []

    for page_num, page in enumerate(doc):
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

                        elements.append({
                            'page': page_num + 1,
                            'text': line_text,
                            'font_size': max_font_size,
                            'bold': is_bold,
                            'italic': is_italic,
                            'char_count': len(line_text),
                            'suggested_tag': None,
                            'user_tag': None
                        })

    doc.close()
    return elements


def detect_heading_hierarchy(elements):
    """Analyze font sizes to determine heading hierarchy"""
    if not elements:
        return elements

    # Count font sizes (rounded to nearest 0.5pt for grouping)
    size_counts = Counter()
    for elem in elements:
        rounded_size = round(elem['font_size'] * 2) / 2
        size_counts[rounded_size] += elem['char_count']

    # Find body text size (most common by character count)
    body_size = size_counts.most_common(1)[0][0] if size_counts else 12

    # Get unique sizes larger than body text
    larger_sizes = sorted([s for s in size_counts.keys() if s > body_size], reverse=True)

    # Map sizes to heading levels
    size_to_heading = {}
    for i, size in enumerate(larger_sizes[:3]):  # Max H1, H2, H3
        size_to_heading[size] = f'H{i + 1}'

    # Assign tags to elements
    for elem in elements:
        rounded_size = round(elem['font_size'] * 2) / 2
        char_count = elem['char_count']

        # Long text is always body
        if char_count > 300:
            elem['suggested_tag'] = 'Body Text'
        # Check if it matches a heading size
        elif rounded_size in size_to_heading:
            elem['suggested_tag'] = size_to_heading[rounded_size]
        # Short bold text might be a heading even at body size
        elif elem['bold'] and char_count < 100:
            # Find the lowest heading level we're using, or H3
            if larger_sizes:
                elem['suggested_tag'] = 'H3'
            else:
                elem['suggested_tag'] = 'H2'
        else:
            elem['suggested_tag'] = 'Body Text'

        elem['user_tag'] = elem['suggested_tag']

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

    # Group consecutive body text into paragraphs
    current_paragraph = []

    for elem in elements:
        tag = elem['user_tag']
        text = html.escape(elem['text'])

        if tag == 'Body Text':
            current_paragraph.append(text)
        else:
            # Flush paragraph if we have one
            if current_paragraph:
                html_parts.append(f'        <p>{" ".join(current_paragraph)}</p>')
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
            current_paragraph.append(text)
        else:
            # Flush paragraph if we have one
            if current_paragraph:
                html_parts.append(f'<p>{" ".join(current_paragraph)}</p>')
                current_paragraph = []

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
    st.markdown("### Step 2: Review and Adjust Structure")
    st.markdown("The tool detected headings based on font size. Review and adjust as needed.")

    # Document title input
    st.session_state.document_title = st.text_input(
        "Document Title (for HTML export)",
        value=st.session_state.document_title,
        help="This will be used as the page title in standalone HTML"
    )

    # Summary statistics
    col1, col2, col3, col4 = st.columns(4)
    h1_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H1')
    h2_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H2')
    h3_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'H3')
    body_count = sum(1 for e in st.session_state.text_elements if e['user_tag'] == 'Body Text')

    with col1:
        st.metric("H1 Headings", h1_count)
    with col2:
        st.metric("H2 Headings", h2_count)
    with col3:
        st.metric("H3 Headings", h3_count)
    with col4:
        st.metric("Body Text", body_count)

    st.markdown("---")

    # Filter options
    filter_option = st.radio(
        "Show:",
        ["All Elements", "Only Headings (H1, H2, H3)", "Only Body Text"],
        horizontal=True
    )

    # Display text elements for review
    st.markdown("#### Text Elements")
    st.caption("Use the dropdown to change element types. Larger font sizes are highlighted.")

    elements_to_show = st.session_state.text_elements
    if filter_option == "Only Headings (H1, H2, H3)":
        elements_to_show = [e for e in elements_to_show if e['user_tag'] in ['H1', 'H2', 'H3']]
    elif filter_option == "Only Body Text":
        elements_to_show = [e for e in elements_to_show if e['user_tag'] == 'Body Text']

    for idx, elem in enumerate(elements_to_show):
        original_idx = st.session_state.text_elements.index(elem)

        col1, col2, col3 = st.columns([3, 2, 1])

        with col1:
            st.markdown(f"""
                <div class="text-preview">
                    <small>Page {elem['page']} • {elem['font_size']:.1f}pt{' • Bold' if elem['bold'] else ''}</small><br>
                    {html.escape(elem['text'][:200])}{'...' if len(elem['text']) > 200 else ''}
                </div>
            """, unsafe_allow_html=True)

        with col2:
            new_tag = st.selectbox(
                "Tag Type",
                ["H1", "H2", "H3", "Body Text"],
                index=["H1", "H2", "H3", "Body Text"].index(elem['user_tag']),
                key=f"tag_{original_idx}",
                label_visibility="collapsed"
            )
            st.session_state.text_elements[original_idx]['user_tag'] = new_tag

        with col3:
            suggested = elem['suggested_tag']
            if suggested != new_tag:
                st.caption(f"(was: {suggested})")

        if idx < len(elements_to_show) - 1:
            st.markdown("<hr style='margin: 0.5rem 0; border: none; border-top: 1px solid #e2e8f0;'>", unsafe_allow_html=True)

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
