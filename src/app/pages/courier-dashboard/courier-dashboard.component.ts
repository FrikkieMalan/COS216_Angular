import { Component, OnInit, inject } from '@angular/core';
import { ApiService, Order }          from '../../services/api.service';

@Component({
  selector: 'app-courier-dashboard',
  standalone: true,
  template: `
    <h2>Pending Deliveries</h2>
    <ul>
      <li *ngFor="let order of orders">
        #{{order.order_id}} — {{order.state}} —
        [{{order.dest_lat}},{{order.dest_lng}}]
        <button (click)="markOutForDelivery(order)">Start Delivery</button>
      </li>
    </ul>
  `,
  imports: []
})
export class CourierDashboardComponent implements OnInit {
  private api = inject(ApiService);
  orders: Order[] = [];

  ngOnInit() { this.loadOrders(); }

  loadOrders() {
    this.api.getAllOrders().subscribe(res => {
      if (res.status === 'success') this.orders = res.data;
    });
  }

  markOutForDelivery(order: Order) {
    this.api.updateOrder(order.order_id, order.dest_lat || 0, order.dest_lng || 0, 'Out for delivery')
      .subscribe(() => this.loadOrders());
  }
}
