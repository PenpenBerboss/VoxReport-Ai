import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface TranscriptItem {
  speaker: string;
  text: string;
}

export interface Report {
  id: number;
  userId: number;
  title: string;
  status: 'pending' | 'processing' | 'uploading' | 'transcribing' | 'analyzing' | 'generating_summary' | 'completed' | 'error';
  progress?: number;
  isArchived?: boolean;
  originalFileName: string;
  transcription?: string;
  transcript?: string | TranscriptItem[]; // Can be string from DB or parsed array
  summary?: string;
  conclusion?: string;
  createdAt: string;
}

export interface PaginatedReports {
  data: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private getHeaders() {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  getReports(archived = false, page = 1, limit = 10) {
    return this.http.get<PaginatedReports>(`/api/reports?archived=${archived}&page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  getReport(id: number) {
    return this.http.get<Report>(`/api/reports/${id}`, { headers: this.getHeaders() });
  }

  upload(file: File, title: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    return this.http.post<{ id: number; status: string }>('/api/reports/upload', formData, { headers: this.getHeaders() });
  }

  deleteReport(id: number) {
    return this.http.delete(`/api/reports/${id}`, { headers: this.getHeaders() });
  }

  updateReport(id: number, data: Partial<Report>) {
    return this.http.patch<Report>(`/api/reports/${id}`, data, { headers: this.getHeaders() });
  }

  downloadFile(id: number) {
    return this.http.get(`/api/reports/${id}/file`, { headers: this.getHeaders(), responseType: 'blob' });
  }
}
