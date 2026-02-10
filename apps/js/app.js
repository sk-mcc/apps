/*
 * Faculty Tools - App Logic
 * Renders tool cards from the TOOLS configuration in links.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('tools-grid');
  const countEl = document.getElementById('tool-count');
  
  if (!grid) {
    console.error('Could not find #tools-grid element');
    return;
  }

  // Check if TOOLS is defined
  if (typeof TOOLS === 'undefined' || !Array.isArray(TOOLS)) {
    grid.innerHTML = '<p class="error-message">No tools configured. Edit js/links.js to add tools.</p>';
    return;
  }

  // Filter out any invalid entries
  const validTools = TOOLS.filter(tool => 
    tool && tool.name && tool.url && tool.icon && tool.description
  );

  if (validTools.length === 0) {
    grid.innerHTML = '<p class="error-message">No tools configured. Edit js/links.js to add tools.</p>';
    return;
  }

  // Update tool count
  if (countEl) {
    countEl.textContent = validTools.length;
  }

  // Render the cards
  grid.innerHTML = validTools.map((tool, index) => `
    <a href="${escapeHtml(tool.url)}" class="tool-card" style="animation-delay: ${index * 0.05}s">
      <div class="tool-icon" aria-hidden="true">
        <i data-lucide="${escapeHtml(tool.icon)}"></i>
      </div>
      <div class="tool-content">
        <h2 class="tool-name">${escapeHtml(tool.name)}</h2>
        <p class="tool-description">${escapeHtml(tool.description)}</p>
      </div>
      <div class="tool-arrow" aria-hidden="true">
        <i data-lucide="arrow-right"></i>
      </div>
    </a>
  `).join('');

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  } else {
    console.error('Lucide icons library not loaded');
  }
});

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
