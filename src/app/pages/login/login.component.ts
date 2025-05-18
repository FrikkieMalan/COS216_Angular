import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, Order }          from '../../services/api.service';
import { WebsocketService } from '../../services/websocket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  studentnum = 'u14439141';
  error = '';

  constructor(
    private wsService: WebsocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.wsService.connect('ws://localhost:3000');
    this.wsService.onMessage().subscribe(msg => {
      console.log('Received WS message:', msg);   //DEBUGGING
      const cmd = msg.cmd;

      if (typeof cmd === 'string' && cmd.startsWith('LOGGED IN')) {
        const parts = cmd.split(' AS ');
        const role = parts[1];
        console.log('Login success, routing to role:', role);  //DEBUGGING
        const path = role === 'Courier' ? 'courier-dashboard' : 'customer-orders';
        if (msg.apikey) {
          localStorage.setItem('apikey', msg.apikey);
        }
        this.router.navigate([path]);
      } else if (msg.status === 'ERROR') {
        this.error = msg.message ?? 'An unknown error occurred';
      }
    });
  }

  submit(): void {
    this.error = '';
    console.log('Submitting login with:', this.username, this.password);   //DEBUGGING
    this.wsService.send('LOGIN', {
      username: this.username,
      password: this.password,
      studentnum: this.studentnum
    });
  }
}