import { Injectable, inject } from '@angular/core';
import { HttpClient }        from '@angular/common/http';
import { Observable }        from 'rxjs';
import Cookies from 'js-cookie';

export interface Order {
  order_id: number;
  tracking_num?: string;
  dest_lat?: number;
  dest_lng?: number;
  state?: string;
  delivery_date?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost/api.php';

  createOrder(customerId: number): Observable<{order_id:number,tracking_num:string}> {
    return this.http.post<{order_id:number,tracking_num:string}>(this.apiUrl, {
      type: 'CreateOrder',
      apikey: Cookies.get('apikey'),
      studentnum: 'u14439141',
      customer_id: customerId
    });
  }

  updateOrder(orderId: number, lat: number, lng: number, state: string) {
    return this.http.post<{updated:number}>(this.apiUrl, {
      type: 'UpdateOrder',
      apikey: Cookies.get('apikey'),
      studentnum: 'u14439141',
      order_id: orderId,
      dest_lat: lat,
      dest_lng: lng,
      state: state
    });
  }

  getAllOrders(): Observable<{status:string,data:Order[]}> {
    return this.http.post<{status:string,data:Order[]}>(this.apiUrl, {
      type: 'GetAllOrders',
      apikey: Cookies.get('apikey'),
      studentnum: 'u14439141'
    });
  }
}
