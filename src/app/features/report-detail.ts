import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { ReportService, Report } from '../core/report.service';
import { SocketService } from '../core/socket.service';
import { MarkdownPipe } from '../core/markdown.pipe';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MarkdownPipe],
  template: `
    <div class="min-h-screen bg-slate-50">
      <nav class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-4">
          <button routerLink="/dashboard" class="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h1 class="text-xl font-bold text-slate-900 truncate max-w-md">{{ report()?.title }}</h1>
        </div>
        
        <div class="flex items-center gap-3">
          <button (click)="onArchive()" class="p-2 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-all" [title]="report()?.isArchived ? 'Désarchiver' : 'Archiver'">
            <i class="fas" [class.fa-archive]="!report()?.isArchived" [class.fa-box-open]="report()?.isArchived"></i>
          </button>
          <button (click)="onDelete()" class="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
          @if (report()?.status === 'completed') {
            <div class="flex gap-2">
              <button (click)="exportWord()" class="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-all">
                <i class="fas fa-file-word"></i>
                Word
              </button>
              <button (click)="exportPDF()" class="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-all">
                <i class="fas fa-file-pdf"></i>
                PDF
              </button>
            </div>
          }
        </div>
      </nav>

      <main class="max-w-4xl mx-auto p-6 md:p-10">
        @if (report(); as r) {
          <div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <!-- Header Info -->
            <div class="p-8 border-b border-slate-100 bg-slate-50/50">
              <div class="flex flex-wrap items-center gap-4 mb-4">
                <span [class]="getStatusClass(r.status)" class="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  {{ getStatusLabel(r.status) }}
                </span>
                <span class="text-sm text-slate-400 flex items-center gap-1">
                  <i class="fas fa-calendar-alt text-xs"></i>
                  {{ r.createdAt | date:'fullDate' }}
                </span>
                <span class="text-sm text-slate-400 flex items-center gap-1">
                  <i class="fas fa-paperclip text-xs"></i>
                  {{ r.originalFileName }}
                </span>
              </div>
              <h2 class="text-4xl font-extrabold text-slate-900 tracking-tight">{{ r.title }}</h2>
            </div>

            <!-- Content -->
            <div class="p-8 md:p-12">
              @if (r.status !== 'completed' && r.status !== 'error') {
                <div class="py-20 text-center max-w-md mx-auto">
                  <div class="relative mb-8">
                    <div class="inline-block animate-spin rounded-full h-24 w-24 border-4 border-indigo-100 border-t-indigo-600"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold">
                      {{ r.progress || 0 }}%
                    </div>
                  </div>
                  <h3 class="text-2xl font-bold text-slate-900 mb-2">{{ getStatusLabel(r.status) }}</h3>
                  <p class="text-slate-500 mb-8">L'IA est en train de transcrire et synthétiser votre réunion.</p>
                  
                  <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div class="bg-indigo-600 h-full transition-all duration-500" [style.width.%]="r.progress || 0"></div>
                  </div>
                </div>
              } @else if (r.status === 'error') {
                <div class="py-20 text-center text-red-600">
                  <i class="fas fa-exclamation-circle text-6xl mb-4"></i>
                  <h3 class="text-xl font-bold">Échec de l'analyse</h3>
                  <p class="text-slate-500 mt-2 mb-8">Une erreur est survenue lors du traitement du fichier.</p>
                  
                  <button (click)="onRetry()" class="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                    <i class="fas fa-redo"></i>
                    Réessayer l'analyse
                  </button>
                </div>
              } @else {
                <div class="prose prose-slate max-w-none">
                  <div class="text-slate-700 text-lg font-light text-justify leading-[1.25] space-y-6" [innerHTML]="r.summary | markdown | async">
                  </div>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="py-20 text-center">
            <p class="text-slate-500">Chargement du rapport...</p>
          </div>
        }
      </main>
    </div>
  `
})
export class ReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reportService = inject(ReportService);
  private socketService = inject(SocketService);

  report = signal<Report | null>(null);

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    this.loadReport(id);

    this.socketService.status$.subscribe(update => {
      if (update.reportId === id) {
        this.report.update(r => r ? { ...r, status: update.status as Report['status'], progress: update.progress } : null);
        if (update.status === 'completed') {
          this.loadReport(id);
        }
      }
    });
  }

  loadReport(id: number) {
    this.reportService.getReport(id).subscribe((res: Report) => this.report.set(res));
  }

  onDelete() {
    const r = this.report();
    if (!r) return;
    if (confirm('Voulez-vous vraiment supprimer ce rapport ?')) {
      this.reportService.deleteReport(r.id).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err) => {
          console.error('Erreur lors de la suppression:', err);
          alert('Erreur lors de la suppression du rapport. Veuillez vérifier votre connexion ou réessayer plus tard.');
        }
      });
    }
  }

  onArchive() {
    const r = this.report();
    if (!r) return;
    const newArchivedState = !r.isArchived;
    this.reportService.updateReport(r.id, { isArchived: newArchivedState }).subscribe(() => {
      this.router.navigate(['/dashboard']);
    });
  }

  onRetry() {
    const r = this.report();
    if (!r) return;
    
    // On redirige directement vers le dashboard avec le paramètre retry
    this.router.navigate(['/dashboard'], { queryParams: { retry: r.id } });
  }

  getStatusLabel(status: string) {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'error': return 'Erreur';
      case 'uploading': return 'Téléversement...';
      case 'transcribing': return 'Transcription...';
      case 'analyzing': return 'Analyse...';
      case 'generating_summary': return 'Rédaction...';
      case 'processing': return 'Traitement...';
      default: return status;
    }
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'uploading':
      case 'transcribing':
      case 'analyzing':
      case 'generating_summary':
      case 'processing': return 'bg-amber-100 text-amber-700 animate-pulse';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  async exportWord() {
    const r = this.report();
    if (!r || !r.summary) return;

    const lines = r.summary.split('\n');
    const children = lines.map(line => {
      const text = line.trim();
      if (!text) return new Paragraph({ spacing: { before: 200, after: 200 } });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let heading: any = undefined;
      let bullet = false;
      let leftIndent = 0;

      if (text.startsWith('A. ')) {
        heading = HeadingLevel.HEADING_1;
      } else if (text.startsWith('I. ') || text.startsWith('II. ') || text.startsWith('III. ') || text.startsWith('IV. ') || text.startsWith('V. ')) {
        heading = HeadingLevel.HEADING_2;
        leftIndent = 360; // 0.25 inch
      } else if (text.startsWith('1. ') || text.startsWith('2. ')) {
        heading = HeadingLevel.HEADING_3;
        leftIndent = 720; // 0.5 inch
      } else if (text.startsWith('a) ') || text.startsWith('b) ')) {
        heading = HeadingLevel.HEADING_4;
        leftIndent = 1080; // 0.75 inch
      } else if (text.startsWith('- ') || text.startsWith('-> ')) {
        bullet = true;
        leftIndent = 720;
      }

      return new Paragraph({
        children: [new TextRun({
          text: text.replace(/^[A-Z]\. |^[IVX]+\. |^\d+\. |^[a-z]\) |^- |^-> /, ''),
          size: heading ? 28 : 24,
        })],
        heading: heading,
        bullet: bullet ? { level: 0 } : undefined,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { 
          line: 300, // 1.25 line spacing (240 * 1.25 = 300)
          before: 240, 
          after: 240 
        },
        indent: { left: leftIndent }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: r.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          ...children
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    this.saveBlob(blob, `${r.title.replace(/\s+/g, '_')}.docx`);
  }

  exportPDF() {
    const r = this.report();
    if (!r || !r.summary) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - (margin * 2);
    const lineHeight = 7 * 1.25; // 1.25 line spacing

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(r.title, pageWidth / 2, y, { align: 'center' });
    y += 15;

    const lines = r.summary.split('\n');
    
    lines.forEach(line => {
      const text = line.trim();
      if (!text) {
        y += 5;
        return;
      }

      let fontSize = 11;
      let fontStyle = 'normal';
      let xOffset = margin;

      if (text.startsWith('A. ')) {
        fontSize = 16;
        fontStyle = 'bold';
      } else if (text.startsWith('I. ') || text.startsWith('II. ') || text.startsWith('III. ') || text.startsWith('IV. ') || text.startsWith('V. ')) {
        fontSize = 14;
        fontStyle = 'bold';
        xOffset += 5;
      } else if (text.startsWith('1. ') || text.startsWith('2. ')) {
        fontSize = 12;
        fontStyle = 'bold';
        xOffset += 10;
      } else if (text.startsWith('a) ') || text.startsWith('b) ') || text.startsWith('- ') || text.startsWith('-> ')) {
        fontSize = 11;
        fontStyle = 'normal';
        xOffset += 15;
      }

      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontSize);

      const cleanText = text.replace(/^[A-Z]\. |^[IVX]+\. |^\d+\. |^[a-z]\) |^- |^-> /, '');
      const splitText = doc.splitTextToSize(cleanText, maxWidth - (xOffset - margin));
      
      if (y + (splitText.length * lineHeight) > 280) {
        doc.addPage();
        y = margin;
      }

      doc.text(splitText, xOffset, y, { align: 'justify', maxWidth: maxWidth - (xOffset - margin) });
      y += (splitText.length * lineHeight) + 4; // Add paragraph spacing
    });

    doc.save(`${r.title.replace(/\s+/g, '_')}.pdf`);
  }

  private saveBlob(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
