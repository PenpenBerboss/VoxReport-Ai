import { Pipe, PipeTransform, inject } from '@angular/core';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  async transform(value: string | undefined): Promise<SafeHtml> {
    if (!value) return '';
    const html = await marked.parse(value);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
