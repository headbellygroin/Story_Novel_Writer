import { Database } from '../lib/database.types';

type Chapter = Database['public']['Tables']['chapters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];

export type ExportFormat = 'markdown' | 'plaintext' | 'html';

export interface ExportOptions {
  format: ExportFormat;
  includeNotes: boolean;
  includeImages: boolean;
}

interface ExportData {
  project: Record<string, string> | null;
  outline: Record<string, string> | null;
  chapters: Chapter[];
  scenes: Scene[];
}

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function buildExportContent(
  data: ExportData,
  options: ExportOptions,
  imageDataUrls?: Map<string, string>,
): string {
  const { project, outline, chapters, scenes } = data;
  const { format, includeNotes, includeImages } = options;

  if (format === 'html') {
    return buildHtmlExport(data, includeNotes, includeImages, imageDataUrls);
  }

  const lines: string[] = [];
  const isMarkdown = format === 'markdown';

  if (project) {
    if (isMarkdown) {
      lines.push(`# ${project.title}`);
      if (project.genre) lines.push(`*${project.genre}*`);
    } else {
      lines.push(project.title.toUpperCase());
      if (project.genre) lines.push(`Genre: ${project.genre}`);
      lines.push('='.repeat(50));
    }
    lines.push('');
  }

  if (outline?.synopsis && includeNotes) {
    if (isMarkdown) {
      lines.push(`> ${outline.synopsis}`);
    } else {
      lines.push(`Synopsis: ${outline.synopsis}`);
    }
    lines.push('');
  }

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterScenes = scenes
      .filter(s => s.chapter_id === chapter.id)
      .sort((a, b) => a.order_index - b.order_index);

    if (isMarkdown) {
      lines.push(`## Chapter ${i + 1}: ${chapter.title}`);
    } else {
      lines.push('');
      lines.push(`CHAPTER ${i + 1}: ${chapter.title}`);
      lines.push('-'.repeat(40));
    }
    lines.push('');

    if (includeNotes && chapter.summary) {
      if (isMarkdown) {
        lines.push(`*${chapter.summary}*`);
      } else {
        lines.push(`[Summary: ${chapter.summary}]`);
      }
      lines.push('');
    }

    for (let j = 0; j < chapterScenes.length; j++) {
      const scene = chapterScenes[j];

      if (includeNotes && scene.description) {
        if (isMarkdown) {
          lines.push(`### ${scene.title}`);
          lines.push(`> ${scene.description}`);
        } else {
          lines.push(`--- ${scene.title} ---`);
          lines.push(`[${scene.description}]`);
        }
        lines.push('');
      }

      if (includeImages && scene.generated_image_url) {
        if (isMarkdown) {
          const src = imageDataUrls?.get(scene.id) || scene.generated_image_url;
          lines.push(`![Scene: ${scene.title}](${src})`);
          lines.push('');
        }
      }

      if (scene.content) {
        lines.push(scene.content);
      } else {
        lines.push(isMarkdown ? '*[Scene not yet written]*' : '[Scene not yet written]');
      }

      lines.push('');
      if (j < chapterScenes.length - 1) {
        lines.push(isMarkdown ? '---' : '* * *');
        lines.push('');
      }
    }

    if (chapterScenes.length === 0) {
      lines.push(isMarkdown ? '*[No scenes in this chapter]*' : '[No scenes in this chapter]');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `      <p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function buildHtmlExport(
  data: ExportData,
  includeNotes: boolean,
  includeImages: boolean,
  imageDataUrls?: Map<string, string>,
): string {
  const { project, outline, chapters, scenes } = data;
  const title = project?.title || 'Untitled Novel';

  const parts: string[] = [];

  parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Playfair+Display:wght@700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Merriweather', Georgia, serif;
      font-size: 18px;
      line-height: 1.8;
      color: #1a1a1a;
      background: #faf9f6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .title-page {
      text-align: center;
      padding: 120px 0 80px;
      border-bottom: 2px solid #d4c5a9;
      margin-bottom: 60px;
    }

    .title-page h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 800;
      color: #2c2c2c;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    .title-page .genre {
      font-style: italic;
      color: #6b6355;
      font-size: 20px;
      font-weight: 300;
    }

    .title-page .synopsis {
      margin-top: 32px;
      font-style: italic;
      color: #4a4540;
      font-size: 16px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.7;
    }

    .chapter {
      margin-bottom: 60px;
      page-break-before: always;
    }

    .chapter-header {
      text-align: center;
      margin-bottom: 40px;
      padding-top: 40px;
    }

    .chapter-header h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      color: #2c2c2c;
      margin-bottom: 8px;
    }

    .chapter-header .summary {
      font-style: italic;
      color: #6b6355;
      font-size: 15px;
      max-width: 560px;
      margin: 0 auto;
    }

    .scene {
      margin-bottom: 48px;
    }

    .scene-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #3a3530;
      margin-bottom: 8px;
    }

    .scene-description {
      font-style: italic;
      color: #7a7265;
      font-size: 15px;
      margin-bottom: 20px;
      padding-left: 16px;
      border-left: 3px solid #d4c5a9;
    }

    .scene-image {
      width: 100%;
      border-radius: 8px;
      margin-bottom: 28px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }

    .scene-content p {
      margin-bottom: 1em;
      text-align: justify;
      text-indent: 1.5em;
    }

    .scene-content p:first-child {
      text-indent: 0;
    }

    .scene-content p:first-child::first-letter {
      font-size: 3.2em;
      float: left;
      line-height: 0.8;
      padding-right: 8px;
      padding-top: 4px;
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 800;
      color: #3a3530;
    }

    .scene-separator {
      text-align: center;
      margin: 40px 0;
      color: #b8a88a;
      font-size: 24px;
      letter-spacing: 12px;
    }

    .not-written {
      font-style: italic;
      color: #999;
      text-align: center;
      padding: 40px;
    }

    .no-scenes {
      font-style: italic;
      color: #999;
      text-align: center;
      padding: 40px;
    }

    @media print {
      body { padding: 0; background: white; }
      .chapter { page-break-before: always; }
      .scene-image { box-shadow: none; }
    }

    @media (max-width: 600px) {
      body { font-size: 16px; padding: 20px 16px; }
      .title-page h1 { font-size: 32px; }
      .title-page { padding: 60px 0 40px; }
      .chapter-header h2 { font-size: 26px; }
    }
  </style>
</head>
<body>
`);

  parts.push('  <div class="title-page">');
  parts.push(`    <h1>${escapeHtml(title)}</h1>`);
  if (project?.genre) {
    parts.push(`    <div class="genre">${escapeHtml(project.genre)}</div>`);
  }
  if (includeNotes && outline?.synopsis) {
    parts.push(`    <div class="synopsis">${escapeHtml(outline.synopsis)}</div>`);
  }
  parts.push('  </div>\n');

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterScenes = scenes
      .filter(s => s.chapter_id === chapter.id)
      .sort((a, b) => a.order_index - b.order_index);

    parts.push('  <div class="chapter">');
    parts.push('    <div class="chapter-header">');
    parts.push(`      <h2>Chapter ${i + 1}: ${escapeHtml(chapter.title)}</h2>`);
    if (includeNotes && chapter.summary) {
      parts.push(`      <div class="summary">${escapeHtml(chapter.summary)}</div>`);
    }
    parts.push('    </div>\n');

    if (chapterScenes.length === 0) {
      parts.push('    <div class="no-scenes">No scenes in this chapter</div>');
    }

    for (let j = 0; j < chapterScenes.length; j++) {
      const scene = chapterScenes[j];

      parts.push('    <div class="scene">');

      if (includeNotes && scene.description) {
        parts.push(`      <div class="scene-title">${escapeHtml(scene.title)}</div>`);
        parts.push(`      <div class="scene-description">${escapeHtml(scene.description)}</div>`);
      }

      if (includeImages && scene.generated_image_url) {
        const src = imageDataUrls?.get(scene.id) || scene.generated_image_url;
        parts.push(`      <img class="scene-image" src="${escapeHtml(src)}" alt="Scene: ${escapeHtml(scene.title)}">`);
      }

      if (scene.content) {
        parts.push('      <div class="scene-content">');
        parts.push(textToHtmlParagraphs(scene.content));
        parts.push('      </div>');
      } else {
        parts.push('      <div class="not-written">[Scene not yet written]</div>');
      }

      parts.push('    </div>\n');

      if (j < chapterScenes.length - 1) {
        parts.push('    <div class="scene-separator">* * *</div>\n');
      }
    }

    parts.push('  </div>\n');
  }

  parts.push(`</body>
</html>`);

  return parts.join('\n');
}
