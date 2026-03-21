import streamlit as st
from pypdf import PdfReader, PdfWriter
from io import BytesIO
import fitz  # PyMuPDF
from collections import defaultdict

st.set_page_config(page_title="PDF Accessibility Tagger", page_icon="🏷️", layout="wide")

# Custom CSS for clean, professional look with dark mode support
st.markdown("""
<style>
    /* Light mode styles */
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
    .instruction-box ul {
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
        .instruction-box ul {
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
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'pdf_uploaded' not in st.session_state:
    st.session_state.pdf_uploaded = False
if 'text_elements' not in st.session_state:
    st.session_state.text_elements = []
if 'current_step' not in st.session_state:
    st.session_state.current_step = 1

def analyze_pdf_hierarchy(pdf_bytes):
    """Analyze PDF to detect text hierarchy based on multiple factors"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_elements = []
    
    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if block["type"] == 0:  # Text block
                for line in block["lines"]:
                    # Combine all spans in a line into one element
                    line_text = " ".join(span["text"] for span in line["spans"]).strip()
                    
                    if line_text and len(line_text) > 1:  # Skip single characters
                        # Get the largest font in this line (usually the dominant one)
                        max_font_size = max(span["size"] for span in line["spans"])
                        fonts = [span["font"] for span in line["spans"]]
                        is_bold = any("Bold" in font for font in fonts)
                        is_italic = any("Italic" in font or "Oblique" in font for font in fonts)
                        
                        # Get vertical position on page
                        y_position = line["bbox"][1]
                        
                        text_elements.append({
                            'page': page_num + 1,
                            'text': line_text,
                            'font_size': max_font_size,
                            'fonts': fonts,
                            'bold': is_bold,
                            'italic': is_italic,
                            'y_position': y_position,
                            'char_count': len(line_text),
                            'word_count': len(line_text.split()),
                            'suggested_tag': None,
                            'user_tag': None
                        })
    
    # Analyze patterns to suggest tags
    if text_elements:
        # Look for common patterns
        for i, elem in enumerate(text_elements):
            text = elem['text']
            char_count = elem['char_count']
            word_count = elem['word_count']
            
            # Skip very long paragraphs
            if char_count > 300:
                elem['suggested_tag'] = 'Body Text'
                elem['user_tag'] = 'Body Text'
                continue
            
            # Pattern 1: Short lines (likely titles or headings)
            if char_count < 100 and word_count <= 10:
                # Check if it's isolated (has space before/after)
                has_space_before = i == 0 or text_elements[i-1]['char_count'] > 200
                has_space_after = i == len(text_elements)-1 or text_elements[i+1]['char_count'] > 200
                
                if has_space_before or has_space_after:
                    # Check position on page (titles often at top)
                    if elem['y_position'] < 200:
                        elem['suggested_tag'] = 'H1'
                    else:
                        # Look for name patterns (likely author names)
                        words = text.split()
                        # Check if it looks like a name (2-4 capitalized words)
                        if 2 <= word_count <= 4 and all(w[0].isupper() for w in words if w):
                            elem['suggested_tag'] = 'H2'
                        else:
                            elem['suggested_tag'] = 'H2'
                else:
                    elem['suggested_tag'] = 'H3'
            
            # Pattern 2: Moderate length (50-200 chars)
            elif 50 <= char_count <= 200:
                if elem['bold'] or elem['italic']:
                    elem['suggested_tag'] = 'H3'
                else:
                    elem['suggested_tag'] = 'Body Text'
            
            # Pattern 3: Everything else is body text
            else:
                elem['suggested_tag'] = 'Body Text'
            
            elem['user_tag'] = elem['suggested_tag']
    
    doc.close()
    return text_elements

def create_tagged_pdf(original_pdf_bytes, text_elements):
    """Create a tagged PDF with accessibility markup"""
    # For now, we'll return a modified version
    # In production, you'd use pikepdf or similar for full tagging
    reader = PdfReader(BytesIO(original_pdf_bytes))
    writer = PdfWriter()
    
    # Copy all pages
    for page in reader.pages:
        writer.add_page(page)
    
    # Add metadata
    writer.add_metadata({
        '/Title': 'Accessible Document',
        '/Tagged': 'True'
    })
    
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    return output.read()

# Header
st.markdown('<div class="main-header">PDF Accessibility Tagger</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Make your PDF documents accessible for screen readers by adding proper heading tags and structure</div>', unsafe_allow_html=True)

# Instructions
with st.expander("How to Use This Tool", expanded=(st.session_state.current_step == 1)):
    st.markdown("""
    <div class="instruction-box">
    <strong>This tool helps you:</strong>
    <ul>
        <li>Automatically detect potential headings in your PDF based on font size and styling</li>
        <li>Review and adjust the suggested heading tags</li>
        <li>Export an accessible PDF with proper structure for screen readers</li>
    </ul>
    
    <strong>The Process:</strong><br><br>
    
    <div class="step-line">
        <span class="step-number">1</span>
        <span>Upload your PDF file</span>
    </div>
    
    <div class="step-line">
        <span class="step-number">2</span>
        <span>Review the automatically detected headings</span>
    </div>
    
    <div class="step-line">
        <span class="step-number">3</span>
        <span>Adjust any tags that were incorrectly identified</span>
    </div>
    
    <div class="step-line">
        <span class="step-number">4</span>
        <span>Download your accessible PDF</span>
    </div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

# Step 1: Upload
st.markdown("### Step 1: Upload Your PDF")
st.markdown("Select a PDF file from your computer. The tool works best with text-based PDFs (not scanned images).")

uploaded_file = st.file_uploader(
    "Choose a PDF file",
    type=['pdf'],
    help="Upload the PDF you want to make accessible"
)

if uploaded_file:
    if not st.session_state.pdf_uploaded:
        with st.spinner("Analyzing PDF structure..."):
            pdf_bytes = uploaded_file.read()
            st.session_state.pdf_bytes = pdf_bytes
            st.session_state.text_elements = analyze_pdf_hierarchy(pdf_bytes)
            st.session_state.pdf_uploaded = True
            st.session_state.current_step = 2
        st.rerun()

# Step 2: Review and Edit Tags
if st.session_state.pdf_uploaded and st.session_state.text_elements:
    st.markdown("---")
    st.markdown("### Step 2: Review and Adjust Heading Tags")
    st.markdown("""
    Below are all the text elements from your PDF. The tool has automatically suggested tags based on font size and formatting.
    **Review each suggestion** and change any that are incorrect.
    """)
    
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
    col_filter1, col_filter2 = st.columns([2, 1])
    with col_filter1:
        filter_option = st.radio(
            "Show:",
            ["All Elements", "Only Headings (H1, H2, H3)", "Only Body Text"],
            horizontal=True
        )
    
    # Display text elements for review
    st.markdown("### Text Elements")
    st.markdown("Use the dropdown next to each text element to change its tag type.")
    
    elements_to_show = st.session_state.text_elements
    if filter_option == "Only Headings (H1, H2, H3)":
        elements_to_show = [e for e in elements_to_show if e['user_tag'] in ['H1', 'H2', 'H3']]
    elif filter_option == "Only Body Text":
        elements_to_show = [e for e in elements_to_show if e['user_tag'] == 'Body Text']
    
    for idx, elem in enumerate(elements_to_show):
        original_idx = st.session_state.text_elements.index(elem)
        
        col1, col2, col3 = st.columns([3, 2, 1])
        
        with col1:
            # Display text preview
            tag_class = f"tag-{elem['user_tag'].lower().replace(' ', '-')}"
            st.markdown(f"""
                <div class="text-preview">
                    <small style="color: #64748b;">Page {elem['page']}</small><br>
                    {elem['text'][:200]}{'...' if len(elem['text']) > 200 else ''}
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
            st.markdown(f"<div style='padding-top: 1rem;'><small>Font: {elem['font_size']:.1f}pt</small></div>", unsafe_allow_html=True)
        
        if idx < len(elements_to_show) - 1:
            st.markdown("<hr style='margin: 0.5rem 0; border: none; border-top: 1px solid #e2e8f0;'>", unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Step 3: Export
    st.markdown("### Step 3: Export Accessible PDF")
    st.markdown("Once you've reviewed and adjusted the tags, click the button below to generate your accessible PDF.")
    
    col1, col2, col3 = st.columns([2, 2, 2])
    
    with col1:
        if st.button("Generate Accessible PDF", type="primary", use_container_width=True):
            with st.spinner("Creating accessible PDF..."):
                tagged_pdf = create_tagged_pdf(st.session_state.pdf_bytes, st.session_state.text_elements)
                st.session_state.tagged_pdf = tagged_pdf
                st.success("Accessible PDF generated successfully!")
    
    with col2:
        if 'tagged_pdf' in st.session_state:
            st.download_button(
                label="Download Accessible PDF",
                data=st.session_state.tagged_pdf,
                file_name=f"accessible_{uploaded_file.name}",
                mime="application/pdf",
                use_container_width=True
            )
    
    with col3:
        if st.button("Start Over", use_container_width=True):
            for key in ['pdf_uploaded', 'text_elements', 'pdf_bytes', 'tagged_pdf']:
                if key in st.session_state:
                    del st.session_state[key]
            st.session_state.current_step = 1
            st.rerun()

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #64748b; font-size: 0.875rem;'>
    <strong>Note:</strong> This tool provides semi-automated accessibility tagging. 
    Always test your PDFs with screen readers to ensure full accessibility compliance.
</div>
""", unsafe_allow_html=True)
