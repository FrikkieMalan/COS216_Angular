import { Injectable, inject } from '@angular/core';
import { HttpClient }        from '@angular/common/http';
import { Observable, throwError, of }        from 'rxjs';

export interface Order {
  order_id: number;
  tracking_num?: string;
  dest_lat?: number;
  dest_lng?: number;
  state?: string;
  delivery_date?: string;
  createdAt?: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = 'https://wheatley.cs.up.ac.za/u14439141/api.php';

  updateOrder(orderId: number, lat: number, lng: number, state: string) {
    if (!isBrowser()) {
      return throwError(() => new Error('Not running in browser context'));
    }
  
    const apikey = localStorage.getItem('apikey');
  
    return this.http.post<{ updated: number }>(this.apiUrl, {
      type: 'UpdateOrder',
      apikey,
      studentnum: 'u14439141',
      order_id: orderId,
      dest_lat: lat,
      dest_lng: lng,
      state: state
    });
  }

  getAllOrders(): Observable<{status:string,data:Order[]}> {
    if (!isBrowser()) {
      return throwError(() => new Error('Not running in browser context'));
    }
  
    const apikey = localStorage.getItem('apikey');
  
    return this.http.post<{ status: string, data: Order[] }>(this.apiUrl, {
      type: 'GetAllOrders',
      apikey,
      studentnum: 'u14439141'
    });
  }
}
