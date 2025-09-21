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
 * Simple markdown to HTML converter for analysis results with XSS protection
 */
export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Split content to handle potential HTML injection
  let html = markdown;

  // Escape any existing HTML tags first to prevent XSS
  html = html.replace(/<[^>]*>/g, (match) => escapeTextContent(match));

  // Headers (## and ###)
  html = html.replace(/^### (.+)$/gm, (match, content) => {
    const safeContent = escapeTextContent(content);
    return `<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">${safeContent}</h3>`;
  });
  
  html = html.replace(/^## (.+)$/gm, (match, content) => {
    const safeContent = escapeTextContent(content);
    return `<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3">${safeContent}</h2>`;
  });

  // Bold text (**text**)  
  html = html.replace(/\*\*(.+?)\*\*/g, (match, content) => {
    const safeContent = escapeTextContent(content);
    return `<strong class="font-semibold text-gray-900 dark:text-gray-100">${safeContent}</strong>`;
  });

  // Bullet points (- item)
  html = html.replace(/^- (.+)$/gm, (match, content) => {
    const safeContent = escapeTextContent(content);
    return `<li class="ml-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeContent}</li>`;
  });
  
  // Numbered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, (match, content) => {
    const safeContent = escapeTextContent(content);
    return `<li class="ml-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeContent}</li>`;
  });

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul class="space-y-1 mb-4">${match}</ul>`;
  });

  // Handle line breaks - escape content between tags
  html = html.replace(/\n\n/g, '</p><p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if no other block elements
  if (!html.includes('<h2>') && !html.includes('<h3>') && !html.includes('<ul>')) {
    // Escape any remaining unhandled content
    const safeContent = html.replace(/([^<>]+)/g, (match) => {
      if (!match.includes('class=')) {
        return escapeTextContent(match);
      }
      return match;
    });
    html = `<p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">${safeContent}</p>`;
  }

  // Clean up any empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

