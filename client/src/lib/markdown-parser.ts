/**
 * Safely escape text content to prevent XSS while preserving basic characters
 */
function escapeTextContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Remove dangerous HTML tags and attributes while preserving safe ones
 */
function sanitizeHtml(html: string): string {
  // Define allowed tags
  const allowedTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 
                       'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'hr',
                       'blockquote', 'pre', 'code'];
  
  // Remove dangerous tags completely (script, iframe, etc.)
  html = html.replace(/<(script|iframe|object|embed|form|input)[^>]*>.*?<\/\1>/gi, '');
  html = html.replace(/<(script|iframe|object|embed|form|input)[^>]*>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');
  
  return html;
}

/**
 * Simple markdown to HTML converter for analysis results with XSS protection
 */
export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Split content to handle potential HTML injection
  let html = markdown;

  // Sanitize HTML instead of escaping all tags
  html = sanitizeHtml(html);

  // Headers (## and ###) - only process if not already HTML tags
  html = html.replace(/^### (.+)$/gm, (match, content) => {
    if (content.includes('<h3')) return match; // Skip if already HTML
    return `<h3 class="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2">${content}</h3>`;
  });
  
  html = html.replace(/^## (.+)$/gm, (match, content) => {
    if (content.includes('<h2')) return match; // Skip if already HTML
    return `<h2 class="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-3">${content}</h2>`;
  });

  // Bold text (**text**) - only process if not already HTML tags  
  html = html.replace(/\*\*(.+?)\*\*/g, (match, content) => {
    if (content.includes('<strong') || content.includes('<b>')) return match;
    return `<strong class="font-semibold text-gray-900 dark:text-white">${content}</strong>`;
  });

  // Bullet points (- item) - only process if not already HTML list
  html = html.replace(/^- (.+)$/gm, (match, content) => {
    if (content.includes('<li')) return match; // Skip if already HTML
    return `<li class="ml-4 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">${content}</li>`;
  });
  
  // Numbered lists (1. item) - only process if not already HTML list
  html = html.replace(/^\d+\. (.+)$/gm, (match, content) => {
    if (content.includes('<li')) return match; // Skip if already HTML
    return `<li class="ml-4 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">${content}</li>`;
  });

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul class="space-y-1 mb-4">${match}</ul>`;
  });

  // Handle line breaks - escape content between tags
  html = html.replace(/\n\n/g, '</p><p class="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3">');
  html = html.replace(/\n/g, '<br>');

  // Add CSS classes to existing HTML tags if they don't have them
  html = html.replace(/<h2(?![^>]*class=)[^>]*>/g, '<h2 class="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-3">');
  html = html.replace(/<h3(?![^>]*class=)[^>]*>/g, '<h3 class="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2">');
  html = html.replace(/<ul(?![^>]*class=)[^>]*>/g, '<ul class="space-y-1 mb-4">');
  html = html.replace(/<li(?![^>]*class=)[^>]*>/g, '<li class="ml-4 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">');
  html = html.replace(/<p(?![^>]*class=)[^>]*>/g, '<p class="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3">');
  html = html.replace(/<strong(?![^>]*class=)[^>]*>/g, '<strong class="font-semibold text-gray-900 dark:text-white">');

  // Wrap in paragraph if no other block elements and not already wrapped
  if (!html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>') && 
      !html.includes('<ul>') && !html.includes('<ol>') && !html.includes('<p>') && 
      !html.includes('<div>') && html.trim()) {
    html = `<p class="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3">${html}</p>`;
  }

  // Clean up any empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

