import streamlit as st
import streamlit.components.v1 as components
from ics import Calendar
from datetime import datetime, timedelta
import requests

# Import configuration
from podium_config import CLASS_CALENDARS, DEFAULT_TFW_PROMPT, DEFAULT_TFW_MINUTES, DEFAULT_AGENDA

# --- PAGE SETUP ---
st.set_page_config(page_title="Classroom Podium", page_icon="💻", layout="wide")

# --- INITIALIZE SESSION STATE ---
if 'mode' not in st.session_state:
    st.session_state.mode = 'setup'
if 'selected_class' not in st.session_state:
    st.session_state.selected_class = list(CLASS_CALENDARS.keys())[0]
if 'agenda' not in st.session_state:
    st.session_state.agenda = DEFAULT_AGENDA
if 'is_tfw' not in st.session_state:
    st.session_state.is_tfw = True
if 'tfw_prompt' not in st.session_state:
    st.session_state.tfw_prompt = DEFAULT_TFW_PROMPT
if 'tfw_minutes' not in st.session_state:
    st.session_state.tfw_minutes = DEFAULT_TFW_MINUTES

# --- HELPER FUNCTIONS ---

def fetch_calendar_events(cal_url, days_ahead=7):
    """Fetch and parse calendar events from Google Calendar ICS URL.
    
    Args:
        cal_url: URL to the .ics calendar file
        days_ahead: Number of days to look ahead for events
        
    Returns:
        List of formatted event strings with day labels
    """
    try:
        r = requests.get(cal_url, timeout=10)
        if r.status_code == 200:
            c = Calendar(r.text)
            now = datetime.now().date()
            sorted_events = sorted(list(c.events), key=lambda x: x.begin)
            
            upcoming = []
            for e in sorted_events:
                edate = e.begin.date()
                if now <= edate <= (now + timedelta(days=days_ahead)):
                    day_label = "Today" if edate == now else edate.strftime('%a')
                    upcoming.append(
                        f"{e.name} <span style='color:#38bdf8; font-weight:600; "
                        f"margin-left:8px;'>({day_label})</span>"
                    )
            return upcoming
    except Exception as e:
        st.warning(f"Could not fetch calendar: {str(e)}")
        return []

def render_glass_card(header, content):
    """Render a glass-morphism style card with header and content.
    
    Args:
        header: Card title text
        content: HTML content for card body
        
    Returns:
        Formatted HTML string
    """
    return f"""
    <div class='glass-card'>
        <div class='card-header'>{header}</div>
        {content}
    </div>
    """

def format_agenda_items(agenda_text):
    """Convert agenda text into formatted HTML list items.
    
    Args:
        agenda_text: Multi-line string of agenda items
        
    Returns:
        HTML string of list items
    """
    items = [line.strip() for line in agenda_text.split('\n') if line.strip()]
    return "".join([f"<li>{item}</li>" for item in items])

# --- GLOBAL CSS ---
st.markdown("""
<style>
    :root {
        --bg-primary: #050a10;
        --bg-gradient-start: #111a2e;
        --bg-glass: rgba(13, 17, 23, 0.6);
        --color-accent: #38bdf8;
        --color-accent-bright: #7dd3fc;
        --color-text: #e6edf3;
        --color-text-dim: #94a3b8;
        --border-glass: rgba(56, 189, 248, 0.2);
        --shadow-glow: rgba(56, 189, 248, 0.2);
    }

    .block-container {
        padding-top: 5rem !important;
    }

    .stApp {
        background-color: var(--bg-primary) !important; 
        background-image: radial-gradient(circle at 0% 0%, var(--bg-gradient-start) 0%, var(--bg-primary) 60%) !important;
    }
    
    html, body, [class*="css"] {
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        font-weight: 300 !important;
        color: var(--color-text) !important;
    }
    
    .glass-card { 
        background: var(--bg-glass) !important; 
        backdrop-filter: blur(12px) !important; 
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid var(--border-glass) !important; 
        border-radius: 12px !important; 
        padding: 25px !important; 
        margin-bottom: 20px !important; 
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2) !important;
    }
    
    .dashboard-title { 
        font-size: 5em !important; 
        font-weight: 200 !important; 
        color: #ffffff !important; 
        margin-top: -20px !important; 
        margin-bottom: 0px !important; 
        letter-spacing: -1px !important;
        text-shadow: 0 0 30px var(--shadow-glow) !important;
    }
    
    .dashboard-subtitle { 
        font-size: 2em !important; 
        color: var(--color-accent) !important; 
        margin-bottom: 30px !important; 
        font-weight: 500 !important;
        letter-spacing: 1px !important;
    }
    
    .card-header {
        font-size: 1.4vw !important; 
        color: var(--color-accent) !important; 
        margin-bottom: 15px !important;
        text-transform: uppercase !important;
        letter-spacing: 2px !important;
        border-bottom: 1px solid var(--border-glass) !important;
        padding-bottom: 8px !important;
    }
    
    .card-list {
        font-size: 1.4vw !important; 
        line-height: 1.6 !important;
        color: var(--color-text) !important;
        list-style-position: inside !important;
        padding-left: 5px !important;
    }
    
    .tfw-notice { 
        background: linear-gradient(90deg, rgba(3, 105, 161, 0.2) 0%, rgba(3, 105, 161, 0.05) 100%) !important;
        border-left: 4px solid #0284c7 !important; 
        color: #e0f2fe !important; 
        padding: 20px !important; 
        margin-top: 10px !important; 
        border-radius: 0 8px 8px 0 !important;
        font-size: 1.4vw !important; 
    }
    
    div.stButton > button {
        background: transparent !important;
        color: rgba(56, 189, 248, 0.7) !important; 
        border: 1px solid rgba(56, 189, 248, 0.3) !important;
        border-radius: 4px !important;
        padding: 6px 15px !important;
        font-weight: 300 !important;
        letter-spacing: 1px !important;
        text-transform: uppercase !important;
        font-size: 0.8em !important;
        transition: all 0.3s ease !important;
    }
    div.stButton > button:hover {
        border-color: var(--color-accent) !important;
        color: #ffffff !important;
        box-shadow: 0 0 10px var(--shadow-glow) !important;
    }
</style>
""", unsafe_allow_html=True)

# --- SCREEN 1: SETUP ---
if st.session_state.mode == 'setup':
    st.markdown("## Podium Setup")
    
    col1, col2 = st.columns(2)
    
    with col1:
        class_options = list(CLASS_CALENDARS.keys())
        default_index = class_options.index(st.session_state.selected_class)
        selected_class = st.selectbox("Select Class", class_options, index=default_index)
        
        agenda_text = st.text_area(
            "Today's Agenda", 
            height=150, 
            value=st.session_state.agenda,
            help="Enter each agenda item on a new line"
        )
        
    with col2:
        st.subheader("Tech-Free Writing")
        is_tfw = st.checkbox("Is today a TFW day?", value=st.session_state.is_tfw)
        
        if is_tfw:
            tfw_prompt = st.text_area(
                "Writing Prompt", 
                height=100, 
                value=st.session_state.tfw_prompt,
                help="The prompt students will see during writing time"
            )
            tfw_minutes = st.number_input(
                "Duration (minutes)", 
                value=st.session_state.tfw_minutes, 
                min_value=1, 
                max_value=30
            )
        else:
            tfw_prompt = ""
            tfw_minutes = 0

    st.markdown("<br>", unsafe_allow_html=True)
    
    if st.button("Launch Welcome Screen", type="primary", use_container_width=True):
        st.session_state.selected_class = selected_class
        st.session_state.cal_url = CLASS_CALENDARS[selected_class]
        st.session_state.agenda = agenda_text
        st.session_state.is_tfw = is_tfw
        st.session_state.tfw_prompt = tfw_prompt
        st.session_state.tfw_minutes = tfw_minutes
        st.session_state.mode = 'welcome'
        st.rerun()

# --- SCREEN 2: WELCOME ---
elif st.session_state.mode == 'welcome':
    left_col, right_col = st.columns([0.8, 1.2], gap="large")

    with left_col:
        st.markdown(
            f"<div class='dashboard-title'>Welcome</div>", 
            unsafe_allow_html=True
        )
        st.markdown(
            f"<div class='dashboard-subtitle'>{datetime.now().strftime('%A, %B %d')}</div>", 
            unsafe_allow_html=True
        )
        
        if st.session_state.is_tfw:
            st.markdown(
                """<div class='tfw-notice'>
                <strong>Tech-Free Writing Today</strong><br/>
                Have your journal and pen ready.
                </div>""", 
                unsafe_allow_html=True
            )
            st.markdown("<br><br>", unsafe_allow_html=True)
            
            if st.button("Start Writing Session", type="primary"):
                st.session_state.mode = 'focus'
                st.rerun()

        st.markdown("<br><br><br><br>", unsafe_allow_html=True)
        
        if st.button("Edit Setup"):
            st.session_state.mode = 'setup'
            st.rerun()

    with right_col:
        # Render agenda card
        agenda_items = format_agenda_items(st.session_state.agenda)
        agenda_card = render_glass_card(
            "Today's Agenda", 
            f"<ul class='card-list'>{agenda_items}</ul>"
        )
        st.markdown(agenda_card, unsafe_allow_html=True)

        # Fetch and render upcoming events card
        upcoming_events = []
        if 'cal_url' in st.session_state and st.session_state.cal_url:
            upcoming_events = fetch_calendar_events(st.session_state.cal_url)
        
        if upcoming_events:
            upcoming_content = f"<ul class='card-list'>{''.join([f'<li>{x}</li>' for x in upcoming_events])}</ul>"
        else:
            upcoming_content = "<div style='color:#94a3b8; font-style:italic;'>No upcoming deadlines found.</div>"
        
        upcoming_card = render_glass_card("Upcoming", upcoming_content)
        st.markdown(upcoming_card, unsafe_allow_html=True)

# --- SCREEN 3: FOCUS MODE ---
elif st.session_state.mode == 'focus':
    # Exit button in top-right corner
    col1, col2 = st.columns([11, 1])
    with col2: 
        if st.button("Exit"):
            st.session_state.mode = 'welcome'
            st.rerun()

    total_minutes = st.session_state.tfw_minutes
    prompt_text = st.session_state.tfw_prompt
    
    # Embedded HTML/CSS/JS for focus mode with timer
    focus_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body {{
            background-color: transparent;
            font-family: 'Segoe UI', Roboto, sans-serif;
            color: white;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 800px;
        }}
        .prompt {{
            font-size: clamp(2em, 3vw, 2.5em);
            color: #ffffff;
            text-align: center;
            margin-top: 50px;
            margin-bottom: 60px;
            font-weight: 300;
            width: 80%;
            line-height: 1.3;
            transition: color 0.5s ease;
        }}
        .grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            width: 90%;
            max-width: 1400px;
        }}
        .card {{
            background: rgba(13, 17, 23, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 12px;
            padding: 40px;
            min-height: 350px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start; 
            position: relative;
            transition: all 0.5s ease;
        }}
        .card-header {{
            font-size: clamp(1.2em, 2vw, 1.8em);
            color: #38bdf8;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-bottom: 1px solid rgba(56, 189, 248, 0.2);
            padding-bottom: 12px;
            margin-bottom: 20px;
        }}
        .content-box {{ 
            margin-top: 10px; 
        }}
        ul {{
            font-size: clamp(1.4em, 2.1vw, 1.6em);
            font-weight: 300;
            color: #cde2f7;
            line-height: 1.8;
            padding-left: 25px;
            margin: 0;
        }}
        ul li {{
            margin-bottom: 12px;
        }}
        #timer {{
            font-size: clamp(1.4em, 2.1vw, 1.6em);
            font-weight: 300;
            color: #cde2f7;
            text-align: center;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
            margin-top: 40px;
            transition: all 0.5s ease;
        }}
        #progress-container {{
            width: 100%;
            background-color: rgba(56, 189, 248, 0.15);
            height: 6px;
            border-radius: 3px;
            margin-top: 30px;
            overflow: hidden;
        }}
        #progress-bar {{
            height: 100%;
            background-color: #0ea5e9;
            width: 0%;
            transition: width 0.3s linear;
        }}
        
        /* Completion pulse animation */
        @keyframes gentle-pulse {{
            0%, 100% {{
                box-shadow: 0 0 20px rgba(134, 239, 172, 0.3),
                            0 0 40px rgba(134, 239, 172, 0.1);
                border-color: rgba(134, 239, 172, 0.5);
            }}
            50% {{
                box-shadow: 0 0 40px rgba(134, 239, 172, 0.5),
                            0 0 80px rgba(134, 239, 172, 0.2);
                border-color: rgba(134, 239, 172, 0.8);
            }}
        }}
        
        .complete {{
            border-color: rgba(134, 239, 172, 0.5) !important;
            background: rgba(13, 17, 23, 0.85) !important;
            animation: gentle-pulse 2s ease-in-out infinite;
        }}
        .complete .card-header {{
            color: #86efac !important;
            border-bottom-color: rgba(134, 239, 172, 0.3) !important;
        }}
        .complete #timer {{
            color: #86efac !important;
            font-size: clamp(2.2em, 4vw, 3.5em) !important;
            text-shadow: 0 0 30px rgba(134, 239, 172, 0.5) !important;
        }}
        .complete #progress-bar {{
            background-color: #22c55e !important;
        }}
        .prompt-complete {{
            color: #86efac !important;
            text-shadow: 0 0 30px rgba(134, 239, 172, 0.4) !important;
        }}
    </style>
    </head>
    <body>
        <div class="prompt" id="prompt">{prompt_text}</div>
        <div class="grid">
            <div class="card">
                <div class="card-header">Reminders</div>
                <div class="content-box">
                    <ul>
                        <li>Put all technology away.</li>
                        <li>Keep your pen moving.</li>
                        <li>If stuck, write "I am stuck" or "I'm not sure what to write" until you get unstuck.</li>
                    </ul>
                </div>
            </div>
            <div class="card" id="timer-card">
                <div class="card-header">Time Remaining</div>
                <div class="content-box">
                    <div id="timer">Loading...</div>
                    <div id="progress-container">
                        <div id="progress-bar"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            const totalMinutes = {total_minutes};
            const totalSeconds = totalMinutes * 60;
            let remaining = totalSeconds;
            let completed = false;
            
            const timerEl = document.getElementById('timer');
            const barEl = document.getElementById('progress-bar');
            const timerCard = document.getElementById('timer-card');
            const promptEl = document.getElementById('prompt');
            
            function getFuzzyTime(seconds) {{
                let minutes = seconds / 60;
                if (minutes >= 5) return "About " + Math.round(minutes) + " minutes";
                if (minutes >= 3.5) return "About 4 minutes";
                if (minutes >= 2.75) return "About 3 minutes";
                if (minutes >= 2.25) return "About 2.5 minutes";
                if (minutes >= 1.75) return "About 2 minutes";
                if (minutes >= 1.25) return "About 1.5 minutes";
                if (minutes >= 0.75) return "About 1 minute";
                if (minutes > 0) return "< 1 minute";
                return "Time to wrap up";
            }}
            
            // Web Audio API for a clean, gentle chime
            function playGentleChime() {{
                try {{
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    
                    // Create two oscillators for a richer tone
                    const osc1 = audioCtx.createOscillator();
                    const osc2 = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    
                    // Pleasant frequencies (C5 and E5 for a major third)
                    osc1.frequency.value = 523.25;  // C5
                    osc2.frequency.value = 659.25;  // E5
                    osc1.type = 'sine';
                    osc2.type = 'sine';
                    
                    // Connect oscillators through gain
                    osc1.connect(gainNode);
                    osc2.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    
                    // Gentle envelope - fade in and out
                    const now = audioCtx.currentTime;
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1);  // Soft attack
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);  // Long decay
                    
                    // Play the chime
                    osc1.start(now);
                    osc2.start(now);
                    osc1.stop(now + 1.5);
                    osc2.stop(now + 1.5);
                    
                    // Play a second chime after a pause
                    setTimeout(() => {{
                        const osc3 = audioCtx.createOscillator();
                        const osc4 = audioCtx.createOscillator();
                        const gainNode2 = audioCtx.createGain();
                        
                        osc3.frequency.value = 659.25;  // E5
                        osc4.frequency.value = 783.99;  // G5
                        osc3.type = 'sine';
                        osc4.type = 'sine';
                        
                        osc3.connect(gainNode2);
                        osc4.connect(gainNode2);
                        gainNode2.connect(audioCtx.destination);
                        
                        const now2 = audioCtx.currentTime;
                        gainNode2.gain.setValueAtTime(0, now2);
                        gainNode2.gain.linearRampToValueAtTime(0.12, now2 + 0.1);
                        gainNode2.gain.exponentialRampToValueAtTime(0.01, now2 + 2);
                        
                        osc3.start(now2);
                        osc4.start(now2);
                        osc3.stop(now2 + 2);
                        osc4.stop(now2 + 2);
                    }}, 600);
                    
                }} catch (e) {{
                    console.log("Web Audio not supported:", e);
                }}
            }}
            
            const interval = setInterval(() => {{
                remaining--;
                timerEl.innerText = getFuzzyTime(remaining);
                
                const progress = ((totalSeconds - remaining) / totalSeconds) * 100;
                barEl.style.width = progress + "%";
                
                if (remaining <= 0 && !completed) {{
                    completed = true;
                    clearInterval(interval);
                    
                    // Visual transition with pulsing animation
                    timerEl.innerText = "Time to wrap up";
                    timerCard.classList.add('complete');
                    promptEl.classList.add('prompt-complete');
                    
                    // Play gentle two-tone chime
                    playGentleChime();
                }}
            }}, 1000);
            
            // Initial display
            timerEl.innerText = getFuzzyTime(remaining);
        </script>
    </body>
    </html>
    """
    
    components.html(focus_html, height=850, scrolling=False)
