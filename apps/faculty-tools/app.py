import streamlit as st
import pandas as pd
from ics import Calendar
from datetime import datetime, timedelta
import re

# --- PAGE SETUP ---
st.set_page_config(page_title="Faculty Tools", page_icon="📚", layout="wide")

# Custom CSS for clean, professional look with dark mode support
st.markdown("""
<style>
    /* Light mode styles */
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

    /* Dark mode styles */
    @media (prefers-color-scheme: dark) {
        .instruction-box {
            background-color: #1e293b;
            border-left: 4px solid #60a5fa;
            color: #e2e8f0;
        }
        .instruction-box strong {
            color: #f1f5f9;
        }
    }

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

    /* Tool card links for home page */
    a.tool-card-link {
        display: block;
        text-decoration: none;
        margin-bottom: 1rem;
    }
    .tool-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1.5rem;
        transition: all 0.2s ease;
        cursor: pointer;
    }
    .tool-card:hover {
        border-color: #0891b2;
        box-shadow: 0 4px 12px rgba(8, 145, 178, 0.15);
        transform: translateY(-2px);
    }
    @media (prefers-color-scheme: dark) {
        .tool-card {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-color: #334155;
        }
        .tool-card:hover {
            border-color: #22d3ee;
            box-shadow: 0 4px 12px rgba(34, 211, 238, 0.15);
        }
    }
    .tool-card h3 {
        margin: 0 0 0.5rem 0;
        color: #0f172a;
        font-size: 1.1rem;
    }
    @media (prefers-color-scheme: dark) {
        .tool-card h3 {
            color: #f1f5f9;
        }
    }
    .tool-card p {
        margin: 0;
        color: #64748b;
        font-size: 0.9rem;
    }
    @media (prefers-color-scheme: dark) {
        .tool-card p {
            color: #94a3b8;
        }
    }
</style>
""", unsafe_allow_html=True)

# --- CONSTANTS ---
COURSE_PATTERN = r'([A-Z]{3,4}\s*[-]?\s*\d{4}(?:[\s-][A-Z0-9]{4,6})?)'

# --- HELPER FUNCTIONS ---

@st.cache_data
def parse_calendar_file(file_contents):
    """Parse ICS calendar file with caching"""
    try:
        return Calendar(file_contents)
    except Exception as e:
        st.error(f"Error reading calendar file: {str(e)}")
        return None

def extract_course_codes(events):
    """Extract unique course codes from calendar events"""
    found_codes = []
    for e in events:
        found_codes.extend(re.findall(COURSE_PATTERN, e.name))
        if e.description:
            found_codes.extend(re.findall(COURSE_PATTERN, e.description))
    
    unique_raw = sorted(list(set(found_codes)), key=len, reverse=True)
    course_codes = []
    for code in unique_raw:
        if not any(code in longer_code for longer_code in course_codes):
            course_codes.append(code)
    course_codes.sort()
    return course_codes

# --- MAIN APP ---

st.title("Faculty Tools")
st.markdown("Tools to automate your syllabus, schedules, and calendar dates.")

st.info("Note: These faculty tools are a work-in-progress. Double-check all output for accuracy.")

# --- SIDEBAR NAVIGATION ---
if 'nav_to' in st.session_state:
    default_index = ["Home", "Syllabus Schedule", "Date Shifter & Calculator"].index(st.session_state.nav_to)
    del st.session_state.nav_to
else:
    default_index = 0

tool_choice = st.sidebar.radio("Select Tool:", [
    "Home",
    "Syllabus Schedule",
    "Date Shifter & Calculator"
], index=default_index)

# ==========================================
# HOME PAGE
# ==========================================
if tool_choice == "Home":
    # --- Local Tools Section ---
    st.markdown("### Tools")
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("""
        <div class="tool-card">
            <h3>Syllabus Schedule Generator</h3>
            <p>Generate formatted HTML schedules from Canvas calendar (.ics) files for your syllabus.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Open Syllabus Schedule", key="nav_syllabus", use_container_width=True):
            st.session_state.nav_to = "Syllabus Schedule"
            st.rerun()

    with col2:
        st.markdown("""
        <div class="tool-card">
            <h3>Date Shifter & Calculator</h3>
            <p>Shift all dates in a calendar file forward or backward for reusing semester schedules.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("Open Date Shifter", key="nav_date", use_container_width=True):
            st.session_state.nav_to = "Date Shifter & Calculator"
            st.rerun()

    # --- Link to Faculty Apps Hub ---
    st.markdown("### More Tools")
    st.markdown("""
    <a href="https://sk-mcc.github.io/apps/" target="_blank" class="tool-card-link">
        <div class="tool-card">
            <h3>Faculty Apps Hub →</h3>
            <p>Browse all faculty tools including Door Sign Generator, Assignment Sheet Helper, QuickPoll, and more.</p>
        </div>
    </a>
    """, unsafe_allow_html=True)

# ==========================================
# TOOL 1: SYLLABUS SCHEDULE
# ==========================================
elif tool_choice == "Syllabus Schedule":
    st.header("Syllabus Schedule Generator")
    
    with st.expander("How to Use This Tool", expanded=True):
        st.markdown("""
        <div class="instruction-box">
        <strong>Step 1: Get your .ics File</strong>
        <ul>
            <li><strong>From Canvas:</strong> Click the Calendar icon on the left navigation. 
            On the right-hand sidebar, click Calendar Feed.</li>
            <li><strong>From Other Apps:</strong> Upload an .ics file from Google, Outlook, or Apple Calendar.</li>
        </ul>
        
        <strong>Step 2: Generate & Paste</strong>
        <ul>
            <li>Select the specific class from the dropdown menu.</li>
            <li>Copy the HTML code and paste it into the Simple Syllabus HTML/code field (&lt; &gt;).</li>
        </ul>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input("First Day of Semester", value=datetime(2026, 1, 12))
        class_format = st.selectbox("Format", ["In-Person", "Hybrid", "Online"])
    with col2:
        uploaded_file = st.file_uploader("Upload your .ics file", type="ics", key="syl_upload")

    if uploaded_file:
        with st.spinner("Parsing calendar..."):
            calendar = parse_calendar_file(uploaded_file.read().decode("utf-8"))
            
        if not calendar:
            st.stop()
            
        all_events = list(calendar.events)
        course_codes = extract_course_codes(all_events)
        
        selected_course = None
        if len(course_codes) > 1:
            st.info("Multiple sections found. Please select:")
            selected_course = st.selectbox("Select Class & Section:", course_codes)
            filtered_events = [
                e for e in all_events 
                if selected_course in e.name or (e.description and selected_course in e.description)
            ]
        elif len(course_codes) == 1:
            selected_course = course_codes[0]
            filtered_events = [
                e for e in all_events 
                if selected_course in e.name or (e.description and selected_course in e.description)
            ]
        else:
            filtered_events = all_events

        # Filter events by start date
        start_date_obj = start_date.date() if hasattr(start_date, 'date') else start_date
        events = sorted(
            [e for e in filtered_events if e.begin.date() >= start_date_obj],
            key=lambda x: x.begin
        )

        if events:
            html_output = ["<div style='font-family: sans-serif; max-width: 800px; margin: 0 auto;'>"]
            
            if class_format in ["Hybrid", "Online"]:
                # Group by week
                events_by_week = {}
                for e in events:
                    monday = e.begin.date() - timedelta(days=e.begin.date().weekday())
                    if monday not in events_by_week:
                        events_by_week[monday] = []
                    events_by_week[monday].append(e)
                
                for week_start in sorted(events_by_week.keys()):
                    week_events = events_by_week[week_start]
                    is_break = any(
                        "break" in x.name.lower() or "holiday" in x.name.lower() 
                        for x in week_events
                    )
                    week_num = ((week_start - start_date_obj).days // 7) + 1
                    
                    if is_break:
                        label = f"Week {week_num} (Break)"
                    else:
                        label = f"Week {week_num}: {week_start.strftime('%b %d')}"
                    
                    html_output.append(
                        f"<div style='border:1px solid #ccc; padding:15px; margin-bottom:15px; "
                        f"border-radius:5px;'><h3>{label}</h3><ul>"
                    )
                    
                    for e in week_events:
                        display_name = (
                            e.name.replace(selected_course, "").strip(": ") 
                            if selected_course else e.name
                        )
                        style = (
                            "color:#900; font-weight:bold;" 
                            if "due" in display_name.lower() 
                            else "color:#333;"
                        )
                        html_output.append(f"<li style='{style}'>{display_name}</li>")
                    
                    html_output.append("</ul></div>")
            else:
                # In-person format
                for e in events:
                    display_name = (
                        e.name.replace(selected_course, "").strip(": ") 
                        if selected_course else e.name
                    )
                    html_output.append(
                        f"<div style='border-bottom:1px solid #eee; padding:10px;'>"
                        f"<strong>{e.begin.format('ddd, MMM D')}:</strong> {display_name}</div>"
                    )
            
            html_output.append("</div>")
            final_html = "\n".join(html_output)
            
            st.success("Schedule generated successfully!")
            st.code(final_html, language="html")
            st.download_button(
                "Download HTML",
                final_html,
                "schedule.html",
                "text/html"
            )

# ==========================================
# TOOL 2: DATE SHIFTER & CALCULATOR
# ==========================================
elif tool_choice == "Date Shifter & Calculator":
    st.header("Date Shift Calculator")
    
    with st.expander("How to Use This Tool", expanded=True):
        st.markdown("""
        <div class="instruction-box">
        <strong>This tool shifts all dates in a calendar file forward or backward.</strong>
        
        <strong>Use Cases:</strong>
        <ul>
            <li>Reusing a previous semester's calendar for a new semester</li>
            <li>Adjusting due dates when the semester start date changes</li>
            <li>Accounting for Canvas's date handling quirks</li>
        </ul>
        
        <strong>Steps:</strong>
        <ol>
            <li>Enter the old reference date (e.g., first day of old semester)</li>
            <li>Enter the new reference date (e.g., first day of new semester)</li>
            <li>Check the Canvas adjustment box if needed (+1 day)</li>
            <li>Upload your old .ics calendar file</li>
            <li>Download the shifted version</li>
        </ol>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    calc_col1, calc_col2, calc_col3 = st.columns(3)
    
    with calc_col1:
        old_ref = st.date_input("Old Reference Date", value=datetime(2025, 8, 25))
    with calc_col2:
        new_ref = st.date_input("New Reference Date", value=datetime(2026, 1, 12))
    with calc_col3:
        canvas_adj = st.checkbox("Add +1 day for Canvas?", value=True)
    
    final_shift = (new_ref - old_ref).days + (1 if canvas_adj else 0)
    
    st.metric("Total Days to Shift", f"{final_shift} days")
    
    st.markdown("---")
    
    shift_file = st.file_uploader("Upload OLD .ics file", type="ics")
    
    if shift_file:
        with st.spinner("Parsing calendar..."):
            calendar = parse_calendar_file(shift_file.read().decode("utf-8"))
        
        if not calendar:
            st.stop()
        
        # Show preview of changes
        st.markdown("### Preview of Changes")
        
        sample_events = list(calendar.events)[:5]  # Show first 5 events
        preview_data = []
        
        for e in sample_events:
            old_date = e.begin.format('YYYY-MM-DD HH:mm')
            new_date = (e.begin + timedelta(days=final_shift)).format('YYYY-MM-DD HH:mm')
            preview_data.append({
                "Event": e.name[:50] + "..." if len(e.name) > 50 else e.name,
                "Old Date": old_date,
                "New Date": new_date
            })
        
        if preview_data:
            st.table(pd.DataFrame(preview_data))
        
        if st.button(f"Generate Shifted ICS (+{final_shift} days)", type="primary"):
            with st.spinner("Shifting dates..."):
                new_calendar = Calendar()
                
                for e in calendar.events:
                    e.begin += timedelta(days=final_shift)
                    e.end += timedelta(days=final_shift)
                    new_calendar.events.add(e)
                
                st.success(f"Shifted {len(calendar.events)} events by {final_shift} days!")
                
                st.download_button(
                    "Download Shifted ICS",
                    str(new_calendar),
                    "shifted_calendar.ics",
                    mime="text/calendar"
                )

# --- FOOTER ---
st.markdown("---")
st.caption("Contact Sarah Karlis with any questions.")
