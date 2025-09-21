/**
 * Simple markdown to HTML converter for analysis results
 */

export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Headers (## and ###)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3">$1</h2>');

  // Bold text (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>');

  // Bullet points (- item)
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">$1</li>');
  
  // Numbered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">$1</li>');

  // Wrap consecutive <li> elements in <ul> or <ol>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul class="space-y-1 mb-4">${match}</ul>`;
  });

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if no other block elements
  if (!html.includes('<h2>') && !html.includes('<h3>') && !html.includes('<ul>')) {
    html = `<p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">${html}</p>`;
  }

  // Clean up any empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

