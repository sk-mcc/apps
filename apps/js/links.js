/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FACULTY TOOLS - LINK CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * TO ADD A NEW TOOL:
 * Just add a new object to the array below with these properties:
 *   - name: Display name for the tool
 *   - url: Link to the tool (relative like "/tools/grades" or full URL)
 *   - icon: Icon name from the reference below
 *   - description: Short description (1-2 sentences)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ICON REFERENCE (Lucide Icons)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * GRADING & ASSESSMENT:
 *   calculator        - calculations, grade computing
 *   percent           - percentages, scores
 *   check-circle      - completion, verification
 *   clipboard-check   - checklists, rubrics
 *   award             - achievements, honors
 *   trophy            - awards, competitions
 *   star              - ratings, favorites
 *   target            - goals, learning objectives
 * 
 * DOCUMENTS & WRITING:
 *   file-text         - documents, papers
 *   file-edit         - editing documents
 *   files             - multiple documents
 *   notebook          - notes, journals
 *   book-open         - reading, textbooks
 *   book              - single book, reference
 *   library           - collections, resources
 *   pen-tool          - writing, editing
 *   type              - text, typography
 *   quote             - citations, quotes
 * 
 * SCHEDULING & TIME:
 *   calendar          - dates, schedules
 *   calendar-days     - multi-day events
 *   calendar-check    - scheduled tasks
 *   clock             - time, deadlines
 *   timer             - timed activities
 *   hourglass         - countdowns, waiting
 *   alarm-clock       - reminders, alerts
 * 
 * COMMUNICATION:
 *   mail              - email, messages
 *   send              - sending, submitting
 *   message-square    - comments, feedback
 *   messages-square   - discussions, forums
 *   megaphone         - announcements
 *   bell              - notifications
 *   at-sign           - mentions, contacts
 * 
 * PEOPLE & GROUPS:
 *   user              - single person, profile
 *   users             - groups, classes
 *   user-check        - attendance, verification
 *   user-plus         - adding students
 *   graduation-cap    - students, graduation
 *   school            - institution, campus
 * 
 * DATA & ANALYTICS:
 *   bar-chart-2       - statistics, charts
 *   line-chart        - trends, progress
 *   pie-chart         - distributions
 *   trending-up       - improvement, growth
 *   table             - spreadsheets, data tables
 *   database          - data storage
 *   list              - lists, inventories
 *   list-checks       - task lists, todos
 * 
 * ORGANIZATION:
 *   folder            - folders, categories
 *   folder-open       - open folder, browsing
 *   archive           - archived items
 *   bookmark          - saved items
 *   tag               - labels, categories
 *   filter            - filtering, sorting
 *   search            - searching
 *   layout-grid       - grid view, organization
 * 
 * TECHNOLOGY & TOOLS:
 *   settings          - configuration, preferences
 *   sliders           - adjustments, controls
 *   wrench            - tools, utilities
 *   cog               - settings, mechanical
 *   link              - links, connections
 *   qr-code           - QR codes
 *   download          - downloads
 *   upload            - uploads, submissions
 *   share             - sharing
 *   external-link     - external links
 *   globe             - web, online
 *   wifi              - connectivity
 * 
 * MEDIA & CONTENT:
 *   image             - images, photos
 *   video             - videos, recordings
 *   mic               - audio, recording
 *   headphones        - listening, audio
 *   presentation      - slideshows
 *   monitor           - screen, display
 *   play-circle       - media playback
 * 
 * GENERAL PURPOSE:
 *   home              - home, main page
 *   info              - information
 *   help-circle       - help, support
 *   lightbulb         - ideas, tips
 *   zap               - quick actions, energy
 *   rocket            - launch, start
 *   sparkles          - new, special
 *   heart             - favorites, wellness
 *   thumbs-up         - approval, feedback
 *   flag              - flagging, marking
 *   map               - navigation, guides
 *   compass           - direction, exploration
 *   key               - access, security
 *   lock              - security, private
 *   unlock            - access granted
 *   shield            - protection, privacy
 *   eye               - visibility, preview
 *   eye-off           - hidden, private
 *   refresh-cw        - refresh, sync
 *   rotate-ccw        - undo, reset
 *   trash             - delete
 *   plus              - add new
 *   minus             - remove
 *   x                 - close, cancel
 *   check             - confirm, done
 *   alert-triangle    - warnings
 *   alert-circle      - alerts, important
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TOOLS = [
  // ─────────────────────────────────────────────────────────────────────────
  // ADD YOUR TOOLS BELOW - just copy this template and fill in the values:
  // ─────────────────────────────────────────────────────────────────────────
  // {
  //   name: "Tool Name",
  //   url: "/path/to/tool",
  //   icon: "icon-name",
  //   description: "Brief description of what this tool does."
  // },
  // ─────────────────────────────────────────────────────────────────────────

  {
    name: "QuickPoll",
    url: "QuickPoll/index.html",
    icon: "bar-chart-2",
    description: "Real-time classroom polling for quizzes and interactive sessions."
  },

  {
    name: "Faculty Selection Schedule Tool",
    url: "selection-tool/selection-tool.html",
    icon: "files",
    description: "Tool to help organize and clean up faculty selection schedule spreadsheets."
  },

  {
    name: "Faculty Tools",
    url: "https://facultytools.streamlit.app/",
    icon: "calendar",
    description: "Calendar and schedule processing tools for faculty."
  },

  {
    name: "Assignment Sheet Generator",
    url: "faculty-tools/assignment-sheet.html",
    icon: "clipboard-check",
    description: "Generate and format faculty assignment sheets."
  },

  {
    name: "Door Sign Generator",
    url: "faculty-tools/door-sign.html",
    icon: "tag",
    description: "Create printable door signs for offices and classrooms."
  },


  // ─────────────────────────────────────────────────────────────────────────
  // ADD MORE TOOLS ABOVE THIS LINE
  // ─────────────────────────────────────────────────────────────────────────
];
