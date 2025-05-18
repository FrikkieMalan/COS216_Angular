import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Order }          from '../../services/api.service';

@Component({
  selector: 'app-customer-orders',
  standalone: true,
  template: `
    <h2>Your Orders</h2>
    <ul>
      <li *ngFor="let order of orders">
        #{{order.order_id}} — {{order.state}} ({{order.createdAt}})
      </li>
    </ul>
  `,
  imports: [CommonModule]
})
export class CustomerOrdersComponent implements OnInit {
  private api = inject(ApiService);
  orders: Order[] = [];

  ngOnInit() {
    this.api.getAllOrders().subscribe(res => {
      if (res.status === 'success') {
        this.orders = res.data;
      }
    });
  }
}
