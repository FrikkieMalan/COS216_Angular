import { Inject, PLATFORM_ID, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface WsMessage {
    status?: string;
    message?: string;
    cmd: string;
    payload?: any;
    data?: any;
  }

  @Injectable({ providedIn: 'root' })
  export class WebsocketService {
    private socket?: WebSocket;
    private isBrowser: boolean;
  
    constructor(@Inject(PLATFORM_ID) platformId: Object) {
      this.isBrowser = isPlatformBrowser(platformId);
    }
  
    connect(url: string): void {
      if (!this.isBrowser) {
        return; // Don’t run in Node/SSR
      }
  
      this.socket = new WebSocket(url);
      this.socket.onopen = () => console.log('WebSocket connected');
      this.socket.onerror = (err) => console.error('WebSocket error:', err);
      this.socket.onclose = () => console.warn('WebSocket closed');
    }
  
    send(cmd: string, data: any): void {
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log('Sending WS message:', cmd, data);   //DEBUGGING
        this.socket.send(JSON.stringify({ cmd, payload: data }));
      }
    }
  
    onMessage(): Observable<any> {
      return new Observable((observer) => {
        if (!this.socket) return;
  
        this.socket.onmessage = (event) => {
          try {
            observer.next(JSON.parse(event.data));
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };
      });
    }
  }
  
