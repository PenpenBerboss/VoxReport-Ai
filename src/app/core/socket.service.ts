import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | undefined;
  private statusSubject = new Subject<{ reportId: number; status: string; progress?: number; error?: string }>();

  status$ = this.statusSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined') {
      this.socket = io();
      this.socket.onAny((event, data) => {
        if (event.startsWith('report:') && event.endsWith(':status')) {
          const reportId = parseInt(event.split(':')[1]);
          this.statusSubject.next({ reportId, ...data });
        }
      });
    }
  }

  listenToReport() {
    // The server emits to all for now, but we could join rooms
  }
}
