import streamlit as st
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO
import fitz  # PyMuPDF for thumbnails
import base64

st.set_page_config(page_title="PDF Merger & Editor", page_icon="📄", layout="wide")

# Custom CSS for clean, professional look
st.markdown("""
<style>
    .stButton button {
        border-radius: 8px;
    }
    /* Primary buttons - teal accent */
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
if 'pdf_files' not in st.session_state:
    st.session_state.pdf_files = []
if 'file_uploader_key' not in st.session_state:
    st.session_state.file_uploader_key = 0
if 'editing_file_idx' not in st.session_state:
    st.session_state.editing_file_idx = None

def extract_pages_from_pdf(pdf_bytes):
    """Extract individual pages from a PDF with thumbnails"""
    reader = PdfReader(BytesIO(pdf_bytes))
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    
    for i, page in enumerate(reader.pages):
        # Extract page as separate PDF
        writer = PdfWriter()
        writer.add_page(page)
        output = BytesIO()
        writer.write(output)
        output.seek(0)
        
        # Generate thumbnail
        fitz_page = doc[i]
        pix = fitz_page.get_pixmap(matrix=fitz.Matrix(0.3, 0.3))  # Scale down for thumbnail
        img_bytes = pix.tobytes("png")
        thumbnail_base64 = base64.b64encode(img_bytes).decode()
        
        pages.append({
            'page_num': i + 1,
            'bytes': output.read(),
            'thumbnail': thumbnail_base64
        })
    
    doc.close()
    return pages

def add_page_numbers(input_pdf_bytes, position='bottom-center', start_num=1):
    """Add page numbers to PDF"""
    reader = PdfReader(BytesIO(input_pdf_bytes))
    writer = PdfWriter()
    
    for page_num, page in enumerate(reader.pages):
        packet = BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        
        positions = {
            'bottom-center': (page_width / 2, 30),
            'bottom-right': (page_width - 50, 30),
            'bottom-left': (50, 30),
            'top-center': (page_width / 2, page_height - 30),
            'top-right': (page_width - 50, page_height - 30),
            'top-left': (50, page_height - 30),
        }
        
        x, y = positions.get(position, (page_width / 2, 30))
        
        can.setFont("Helvetica", 10)
        can.drawCentredString(x, y, str(page_num + start_num))
        can.save()
        
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    return output.read()

def create_toc_page(toc_entries):
    """Create a table of contents page"""
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    can.setFont("Helvetica-Bold", 20)
    can.drawString(50, 750, "Table of Contents")
    
    can.setFont("Helvetica", 12)
    y_position = 700
    
    for entry in toc_entries:
        if y_position < 50:
            can.showPage()
            y_position = 750
        can.drawString(70, y_position, f"{entry['title']}")
        can.drawRightString(550, y_position, f"Page {entry['page']}")
        y_position -= 25
    
    can.save()
    packet.seek(0)
    return packet.read()

def merge_pdfs(pdf_list, add_toc=True, page_num_position='bottom-center', start_num=1):
    """Merge multiple PDFs with optional TOC and page numbers"""
    writer = PdfWriter()
    toc_entries = []
    current_page = 1
    
    if add_toc:
        current_page += 1
    
    all_pages = []
    for pdf_info in pdf_list:
        toc_entries.append({
            'title': pdf_info['toc_title'],
            'page': current_page
        })
        
        # Add pages in order they appear in the pages list
        for page_info in pdf_info['pages']:
            reader = PdfReader(BytesIO(page_info['bytes']))
            all_pages.append(reader.pages[0])
            current_page += 1
    
    if add_toc:
        toc_pdf_bytes = create_toc_page(toc_entries)
        toc_reader = PdfReader(BytesIO(toc_pdf_bytes))
        for page in toc_reader.pages:
            writer.add_page(page)
    
    for page in all_pages:
        writer.add_page(page)
    
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    merged_bytes = output.read()
    
    if page_num_position != 'none':
        merged_bytes = add_page_numbers(merged_bytes, page_num_position, start_num)
    
    return merged_bytes

# UI
col_title, col_clear = st.columns([5, 1])
with col_title:
    st.title("PDF Merger & Editor")
    st.markdown("Upload, reorder pages, and merge PDF files with page numbers and table of contents")
with col_clear:
    st.markdown("<br>", unsafe_allow_html=True)  # Add spacing
    if st.button("Reset All", use_container_width=True, help="Clear all uploaded files and start fresh"):
        st.session_state.pdf_files = []
        st.session_state.file_uploader_key += 1
        st.session_state.editing_file_idx = None
        st.rerun()

# Sidebar settings
with st.sidebar:
    st.header("Settings")
    
    add_toc = st.checkbox("Add Table of Contents", value=False)
    
    page_num_position = st.selectbox(
        "Page Number Position",
        options=['none', 'bottom-center', 'bottom-right', 'bottom-left', 
                'top-center', 'top-right', 'top-left'],
        index=0
    )
    
    start_page_num = st.number_input("Start Page Number", min_value=1, value=1, step=1)
    
    st.markdown("---")
    st.markdown("### Features")
    st.markdown("• Merge multiple PDFs")
    st.markdown("• Reorder pages within PDFs")
    st.markdown("• Add page numbers")
    st.markdown("• Generate TOC")
    st.markdown("• Delete pages")

# File uploader
uploaded_files = st.file_uploader(
    "Upload PDF files",
    type=['pdf'],
    accept_multiple_files=True,
    help="Upload one or more PDF files to merge",
    key=f"file_uploader_{st.session_state.file_uploader_key}"
)

# Add uploaded files to session state
if uploaded_files:
    for uploaded_file in uploaded_files:
        if not any(f['name'] == uploaded_file.name for f in st.session_state.pdf_files):
            pdf_bytes = uploaded_file.read()
            pages = extract_pages_from_pdf(pdf_bytes)
            st.session_state.pdf_files.append({
                'name': uploaded_file.name,
                'bytes': pdf_bytes,
                'toc_title': uploaded_file.name.replace('.pdf', ''),
                'pages': pages
            })

# Page editing view
if st.session_state.editing_file_idx is not None:
    idx = st.session_state.editing_file_idx
    if idx < len(st.session_state.pdf_files):
        pdf_file = st.session_state.pdf_files[idx]
        
        st.markdown(f"### Editing Pages: {pdf_file['name']}")
        
        col1, col2, col3 = st.columns([3, 2, 1])
        with col1:
            st.info(f"Total pages: {len(pdf_file['pages'])}")
        with col2:
            # Download single edited PDF
            if st.button("Download This PDF", use_container_width=True):
                writer = PdfWriter()
                for page_info in pdf_file['pages']:
                    reader = PdfReader(BytesIO(page_info['bytes']))
                    writer.add_page(reader.pages[0])
                output = BytesIO()
                writer.write(output)
                output.seek(0)
                
                st.download_button(
                    label="Download",
                    data=output.read(),
                    file_name=f"edited_{pdf_file['name']}",
                    mime="application/pdf"
                )
        with col3:
            if st.button("Done", use_container_width=True):
                st.session_state.editing_file_idx = None
                st.rerun()
        
        st.markdown("---")
        
        # Display pages with thumbnails
        for page_idx, page_info in enumerate(pdf_file['pages']):
            col1, col2, col3, col4, col5 = st.columns([0.5, 1.5, 2, 1, 1])
            
            with col1:
                st.markdown(f"**{page_idx + 1}**")
            
            with col2:
                # Display thumbnail
                st.image(
                    f"data:image/png;base64,{page_info['thumbnail']}", 
                    width=150
                )
            
            with col3:
                st.text(f"Original page {page_info['page_num']}")
            
            with col4:
                col_up, col_down = st.columns(2)
                with col_up:
                    if st.button("↑", key=f"page_up_{page_idx}", disabled=(page_idx == 0)):
                        pdf_file['pages'][page_idx], pdf_file['pages'][page_idx - 1] = \
                            pdf_file['pages'][page_idx - 1], pdf_file['pages'][page_idx]
                        st.rerun()
                with col_down:
                    if st.button("↓", key=f"page_down_{page_idx}", 
                               disabled=(page_idx == len(pdf_file['pages']) - 1)):
                        pdf_file['pages'][page_idx], pdf_file['pages'][page_idx + 1] = \
                            pdf_file['pages'][page_idx + 1], pdf_file['pages'][page_idx]
                        st.rerun()
            
            with col5:
                if st.button("×", key=f"page_remove_{page_idx}", help="Remove this page"):
                    pdf_file['pages'].pop(page_idx)
                    if len(pdf_file['pages']) == 0:
                        st.session_state.pdf_files.pop(idx)
                        st.session_state.editing_file_idx = None
                    st.rerun()

# Main file list view
elif st.session_state.pdf_files:
    st.markdown("### 📚 Your PDF Files")
    
    # Show different UI based on number of files
    single_file_mode = len(st.session_state.pdf_files) == 1
    
    if single_file_mode:
        # SINGLE FILE MODE - Emphasize editing
        pdf_file = st.session_state.pdf_files[0]
        
        st.info(f"{pdf_file['name']} • {len(pdf_file['pages'])} pages")
        
        st.markdown("#### What would you like to do?")
        
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("Edit Pages", type="primary", use_container_width=True, 
                        help="Reorder, remove pages, or add page numbers"):
                st.session_state.editing_file_idx = 0
                st.rerun()
        
        with col2:
            if st.button("Add More Files to Merge", use_container_width=True,
                        help="Upload additional PDFs to combine"):
                st.info("Use the file uploader above to add more PDFs")
        
        st.markdown("---")
        st.caption("Tip: Click 'Edit Pages' to reorder, remove pages, or download with page numbers")
        if st.button("🔄 Start Over", use_container_width=False):
            st.session_state.pdf_files = []
            st.session_state.file_uploader_key += 1
            st.rerun()
    
    else:
        # MULTIPLE FILES MODE - Emphasize merging
        st.markdown("#### Your Files:")
        
        for idx, pdf_file in enumerate(st.session_state.pdf_files):
            with st.container():
                col1, col2, col3, col4 = st.columns([0.5, 4, 2, 1.5])
                
                with col1:
                    st.markdown(f"**#{idx + 1}**")
                
                with col2:
                    st.markdown(f"**{pdf_file['name']}**")
                    st.caption(f"{len(pdf_file['pages'])} pages")
                
                with col3:
                    new_title = st.text_input(
                        "TOC Title",
                        value=pdf_file['toc_title'],
                        key=f"toc_{idx}",
                        label_visibility="collapsed",
                        placeholder="Table of Contents title"
                    )
                    st.session_state.pdf_files[idx]['toc_title'] = new_title
                
                with col4:
                    subcol1, subcol2, subcol3, subcol4 = st.columns(4)
                    
                    with subcol1:
                        if st.button("↑", key=f"up_{idx}", disabled=(idx == 0), 
                                   help="Move up"):
                            st.session_state.pdf_files[idx], st.session_state.pdf_files[idx - 1] = \
                                st.session_state.pdf_files[idx - 1], st.session_state.pdf_files[idx]
                            st.rerun()
                    
                    with subcol2:
                        if st.button("↓", key=f"down_{idx}", 
                                   disabled=(idx == len(st.session_state.pdf_files) - 1),
                                   help="Move down"):
                            st.session_state.pdf_files[idx], st.session_state.pdf_files[idx + 1] = \
                                st.session_state.pdf_files[idx + 1], st.session_state.pdf_files[idx]
                            st.rerun()
                    
                    with subcol3:
                        if st.button("Edit", key=f"edit_{idx}", help="Edit pages"):
                            st.session_state.editing_file_idx = idx
                            st.rerun()
                    
                    with subcol4:
                        if st.button("×", key=f"remove_{idx}", help="Remove"):
                            st.session_state.pdf_files.pop(idx)
                            st.rerun()
                
                st.markdown("---")
        
        # Action buttons for multiple files
        st.markdown("#### Merge Your PDFs:")
        
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("Merge & Download All", type="primary", use_container_width=True):
                with st.spinner("Merging PDFs..."):
                    try:
                        merged_pdf = merge_pdfs(
                            st.session_state.pdf_files,
                            add_toc=add_toc,
                            page_num_position=page_num_position,
                            start_num=start_page_num
                        )
                        
                        st.download_button(
                            label="Download Merged PDF",
                            data=merged_pdf,
                            file_name="merged_document.pdf",
                            mime="application/pdf",
                            use_container_width=True
                        )
                        st.success("PDF merged successfully!")
                    except Exception as e:
                        st.error(f"Error merging PDFs: {str(e)}")
        
        with col2:
            if st.button("Clear All", use_container_width=True, help="Remove all files"):
                st.session_state.pdf_files = []
                st.session_state.file_uploader_key += 1
                st.session_state.editing_file_idx = None
                st.rerun()

else:
    st.info("Upload PDF files to get started")

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: gray;'>"
    "Built with Streamlit • Upload PDFs • Reorder Pages • Merge • Add Page Numbers • Generate TOC"
    "</div>",
    unsafe_allow_html=True
)
