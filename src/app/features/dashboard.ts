import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService, Report, PaginatedReports } from '../core/report.service';
import { AuthService } from '../core/auth.service';
import { SocketService } from '../core/socket.service';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GoogleGenAI, Type } from "@google/genai";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50">
      <!-- Navbar -->
      <nav class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-2">
          <div class="bg-indigo-600 p-2 rounded-lg">
            <i class="fas fa-file-alt text-white"></i>
          </div>
          <span class="text-xl font-bold text-slate-900 tracking-tight">VoxReport AI</span>
        </div>
        
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-slate-600">{{ auth.user()?.name }}</span>
          <button (click)="auth.logout()" class="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </nav>

      <main class="max-w-6xl mx-auto p-6 md:p-10">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 class="text-3xl font-bold text-slate-900">Mes Rapports</h2>
            <p class="text-slate-500 mt-1">Gérez et consultez vos comptes-rendus de réunion.</p>
          </div>
          
          <div class="flex items-center gap-3">
            <button (click)="toggleArchived()" 
              [class]="showArchived() ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-500 border border-slate-200'"
              class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all">
              <i class="fas" [class.fa-archive]="!showArchived()" [class.fa-list]="showArchived()"></i>
              {{ showArchived() ? 'Voir Actifs' : 'Voir Archivés' }}
            </button>
            
            <button (click)="showUpload.set(true)" 
              class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-100">
              <i class="fas fa-plus"></i>
              Nouveau Rapport
            </button>
          </div>
        </div>

        <!-- Reports Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          @for (report of reports(); track report.id) {
            <div class="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden flex flex-col">
              
              <div class="flex items-start justify-between mb-4">
                <div [routerLink]="['/reports', report.id]" class="p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                  <i class="text-slate-400 group-hover:text-indigo-600 transition-colors"
                    [class]="report.status === 'completed' ? 'fas fa-file-alt' : (report.status === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-sync fa-spin')">
                  </i>
                </div>
                <div class="flex items-center gap-2">
                  <span [class]="getStatusClass(report.status)" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                    {{ getStatusLabel(report.status) }}
                  </span>
                  <button (click)="onDelete(report.id, $event)" class="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Supprimer">
                    <i class="fas fa-trash text-sm"></i>
                  </button>
                  <button (click)="onArchive(report, $event)" class="p-1.5 hover:bg-amber-50 text-slate-300 hover:text-amber-600 rounded-lg transition-all opacity-0 group-hover:opacity-100" [title]="report.isArchived ? 'Désarchiver' : 'Archiver'">
                    <i class="fas text-sm" [class.fa-archive]="!report.isArchived" [class.fa-box-open]="report.isArchived"></i>
                  </button>
                  @if (report.status === 'error') {
                    <button (click)="onRetry(report, $event)" class="p-1.5 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Réessayer">
                      <i class="fas fa-redo text-sm"></i>
                    </button>
                  }
                </div>
              </div>

              <div [routerLink]="['/reports', report.id]" class="flex-grow">
                <h3 class="text-lg font-bold text-slate-900 mb-2 truncate">{{ report.title }}</h3>
                <p class="text-sm text-slate-500 mb-4 line-clamp-2">
                  {{ report.summary || 'En attente de traitement...' }}
                </p>

                @if (report.status !== 'completed' && report.status !== 'error') {
                  <div class="mb-4">
                    <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Progression</span>
                      <span>{{ report.progress || 0 }}%</span>
                    </div>
                    <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="bg-indigo-600 h-full transition-all duration-500" [style.width.%]="report.progress || 0"></div>
                    </div>
                  </div>
                }
              </div>

              <div [routerLink]="['/reports', report.id]" class="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <span class="text-xs text-slate-400 flex items-center gap-1">
                  <i class="fas fa-calendar-alt text-[10px]"></i>
                  {{ report.createdAt | date:'short' }}
                </span>
                <i class="fas fa-arrow-right text-slate-300 group-hover:text-indigo-600 transition-all transform group-hover:translate-x-1"></i>
              </div>
            </div>
          } @empty {
            <div class="col-span-full py-20 text-center">
              <div class="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-cloud-upload-alt text-slate-400 text-3xl"></i>
              </div>
              <h3 class="text-xl font-bold text-slate-900">Aucun rapport pour le moment</h3>
              <p class="text-slate-500 mt-2">Commencez par téléverser un fichier audio ou vidéo.</p>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="flex items-center justify-center gap-2 mt-8 pb-10">
            <button (click)="changePage(currentPage() - 1)" [disabled]="currentPage() === 1"
              class="p-2 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all">
              <i class="fas fa-chevron-left"></i>
            </button>
            
            <div class="flex items-center gap-1">
              @for (p of [].constructor(totalPages()); track $index) {
                <button (click)="changePage($index + 1)"
                  [class]="currentPage() === ($index + 1) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  class="w-10 h-10 flex items-center justify-center rounded-xl border font-medium transition-all">
                  {{ $index + 1 }}
                </button>
              }
            </div>

            <button (click)="changePage(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
              class="p-2 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        }
      </main>

      <!-- Upload Modal -->
      @if (showUpload()) {
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 border border-slate-100">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-2xl font-bold text-slate-900">Nouveau Rapport</h3>
              <button (click)="showUpload.set(false)" class="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <div class="space-y-6">
              <div>
                <label for="uploadTitle" class="block text-sm font-medium text-slate-700 mb-1">Titre de la réunion</label>
                <input type="text" id="uploadTitle" [(ngModel)]="uploadTitle" placeholder="Ex: Réunion d'équipe Hebdo"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
              </div>

              <div class="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-indigo-400 transition-all cursor-pointer"
                (click)="fileInput.click()" (keydown.enter)="fileInput.click()" tabindex="0">
                <input #fileInput type="file" class="hidden" (change)="onFileSelected($event)" accept="audio/*,video/*">
                <i class="fas fa-file-upload text-slate-400 text-4xl mb-2"></i>
                <p class="text-slate-600 font-medium">
                  {{ selectedFile ? selectedFile.name : 'Cliquez pour choisir un fichier' }}
                </p>
                <p class="text-xs text-slate-400 mt-1">Audio ou Vidéo (MP3, MP4, WAV, etc.)</p>
              </div>

              @if (uploadError()) {
                <div class="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {{ uploadError() }}
                </div>
              }

              <button (click)="onUpload()" [disabled]="!selectedFile || uploading()"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2">
                {{ uploading() ? 'Téléversement...' : "Lancer l'analyse" }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  public auth = inject(AuthService);
  private reportService = inject(ReportService);
  private socketService = inject(SocketService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  reports = signal<Report[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);
  pageSize = 9;
  showArchived = signal(false);
  showUpload = signal(false);
  uploadTitle = '';
  selectedFile: File | null = null;
  uploading = signal(false);
  uploadError = signal('');

  ngOnInit() {
    this.loadReports();
    this.socketService.status$.subscribe(update => {
      this.reports.update(list => list.map(r => 
        r.id === update.reportId 
          ? { ...r, status: update.status as Report['status'], progress: update.progress } 
          : r
      ));
    });

    // Gérer le retry via query params
    this.route.queryParams.subscribe(params => {
      if (params['retry']) {
        const reportId = Number(params['retry']);
        // Clear query params to avoid infinite retry loops on refresh
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { retry: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        
        this.reportService.getReport(reportId).subscribe(report => {
          this.onRetry(report, new Event('click'));
        });
      }
    });
  }

  loadReports() {
    this.reportService.getReports(this.showArchived(), this.currentPage(), this.pageSize).subscribe({
      next: (res: PaginatedReports) => {
        this.reports.set(res.data);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
      },
      error: (err) => {
        console.error('Erreur chargement rapports:', err);
      }
    });
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadReports();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleArchived() {
    this.showArchived.update(v => !v);
    this.loadReports();
  }

  onArchive(report: Report, event: Event) {
    event.stopPropagation();
    const newArchivedState = !report.isArchived;
    this.reportService.updateReport(report.id, { isArchived: newArchivedState }).subscribe(() => {
      // Si on change l'état d'archivage, on retire le rapport de la vue actuelle
      this.reports.update(list => list.filter(r => r.id !== report.id));
    });
  }

  onDelete(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer ce rapport ?')) {
      this.reportService.deleteReport(id).subscribe({
        next: () => {
          this.reports.update(list => list.filter(r => r.id !== id));
        },
        error: (err) => {
          console.error('Erreur lors de la suppression:', err);
          alert('Erreur lors de la suppression du rapport. Veuillez réessayer.');
        }
      });
    }
  }

  onRetry(report: Report, event: Event) {
    event.stopPropagation();
    this.reportService.downloadFile(report.id).subscribe(blob => {
      const file = new File([blob], report.originalFileName, { type: blob.type });
      this.processFile(report.id, file);
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  onUpload() {
    if (!this.selectedFile) return;
    const fileToProcess = this.selectedFile;
    this.uploading.set(true);
    this.uploadError.set('');

    this.reportService.upload(fileToProcess, this.uploadTitle).subscribe({
      next: (res) => {
        this.showUpload.set(false);
        this.uploading.set(false);
        this.selectedFile = null;
        this.uploadTitle = '';
        this.loadReports();
        this.processFile(res.id, fileToProcess);
      },
      error: (err: { error?: { error?: string } }) => {
        this.uploadError.set(err.error?.error || 'Erreur lors du téléversement');
        this.uploading.set(false);
      }
    });
  }

  async processFile(reportId: number, file: File) {
    // Simulation de progression fluide
    let simulatedProgress = 0;
    const progressInterval = setInterval(() => {
      if (simulatedProgress < 95) {
        const oldProgress = Math.round(simulatedProgress);
        simulatedProgress += Math.random() * 1.5;
        const newProgress = Math.round(simulatedProgress);
        if (simulatedProgress > 95) simulatedProgress = 95;
        
        // Mise à jour locale pour la fluidité
        this.reports.update(list => list.map(r => 
          r.id === reportId ? { ...r, progress: Math.round(simulatedProgress) } : r
        ));

        // Sync à la DB si le pourcentage a changé de façon significative (tous les 5%)
        if (newProgress !== oldProgress && newProgress % 5 === 0) {
          this.reportService.updateReport(reportId, { progress: newProgress }).subscribe();
        }
      }
    }, 1000);

    try {
      this.updateStatus(reportId, 'uploading', 10);
      
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await fileDataPromise;

      this.updateStatus(reportId, 'transcribing', 30);
      simulatedProgress = Math.max(simulatedProgress, 30);
      
      if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
        throw new Error('Clé API Gemini non configurée');
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      this.updateStatus(reportId, 'analyzing', 60);
      simulatedProgress = Math.max(simulatedProgress, 60);
      
      const prompt = `Tu es un expert en rédaction de comptes-rendus de réunions professionnelles.
      Analyse le fichier audio/vidéo joint et génère un rapport structuré EXACTEMENT selon le modèle suivant.
      
      STRUCTURE DU RAPPORT (À SUIVRE RIGOUREUSEMENT) :
      
      [TITRE COURT DE LA RÉUNION] (ex: SPRINT du 02/04)
      
      Voici le compte-rendu structuré de la réunion basé sur l'enregistrement fourni.
      
      Compte-rendu de Réunion : [TITRE DÉTAILLÉ]
      Date : [DATE DE LA RÉUNION]
      Sujet : [SUJET PRINCIPAL]
      Intervenants : [LISTE DES PARTICIPANTS ET LEURS RÔLES]
      
      1. Résumé Exécutif
      [Un paragraphe synthétique présentant l'essentiel de la réunion]
      
      2. Points Clés Discutés
         1) [Sous-titre du point 1] :
         [Détails du point 1]
         2) [Sous-titre du point 2] :
         [Détails du point 2]
         ...
      
      3. Décisions Prises
      [Liste des décisions ou "Aucune décision formelle n'a été arrêtée lors de cette session."]
      
      4. Liste d'actions à entreprendre (To-Do List)
      | Action | Responsable | Échéance |
      | :--- | :--- | :--- |
      | [Tâche] | [Nom] | [Date] |
      
      5. Transcription Synthétique par Intervenant
      [Nom de l'intervenant 1] : ([Rôle]) :
      - [Point abordé 1]
      - [Point abordé 2]
      
      [Nom de l'intervenant 2] : ([Rôle]) :
      - [Point abordé 1]
      
      Note du rédacteur : [Une analyse critique ou une remarque sur la teneur des échanges]
      
      CONSIGNES DE FORMATAGE :
      - Utilise des puces standard (-) pour les listes.
      - Utilise le format de tableau Markdown pour la To-Do List.
      - Le ton doit être formel et administratif.
      
      STRUCTURE DU RAPPORT ATTENDUE (JSON) :
      - title: Le titre court (ex: SPRINT du 02/04).
      - summary: Le corps du rapport complet (sections 1 à 5 + Note du rédacteur) formaté en Markdown.
      - conclusion: Une synthèse très courte (1-2 phrases) de l'issue finale.
      - transcript: Liste d'objets { speaker: string, text: string } identifiant chaque prise de parole.
      
      Réponds exclusivement au format JSON.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              conclusion: { type: Type.STRING },
              transcript: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ["speaker", "text"]
                }
              }
            },
            required: ["title", "summary", "conclusion", "transcript"]
          }
        }
      });

      this.updateStatus(reportId, 'generating_summary', 90);
      simulatedProgress = Math.max(simulatedProgress, 90);
      
      const responseText = result.text;
      const parsed = JSON.parse(responseText || '{}');

      this.reportService.updateReport(reportId, { 
        status: 'completed', 
        title: parsed.title,
        summary: parsed.summary, 
        conclusion: parsed.conclusion,
        transcript: JSON.stringify(parsed.transcript),
        progress: 100 
      }).subscribe();
    } catch (error: unknown) {
      console.error('Processing error:', error);
      this.reportService.updateReport(reportId, { status: 'error', progress: 0 }).subscribe();
    } finally {
      clearInterval(progressInterval);
    }
  }

  private updateStatus(reportId: number, status: string, progress: number) {
    this.reportService.updateReport(reportId, { status: status as Report['status'], progress }).subscribe();
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
}
