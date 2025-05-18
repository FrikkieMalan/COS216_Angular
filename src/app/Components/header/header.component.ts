import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { WheatleyService } from '../../services/wheatley.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./variables.css', './header.component.css']
})
export class HeaderComponent implements OnInit {
  isLoggedIn: boolean = false;
  currentTheme: 'light' | 'dark' = 'light';

  constructor(
    private router: Router,
    private wheatleyService: WheatleyService
  ) { }

  ngOnInit(): void {
    // Check if user is logged in
    this.checkLoginStatus();

    // Get current theme
    this.currentTheme = this.wheatleyService.getTheme();
  }

  checkLoginStatus(): void {
    // Check if the user has an API key (indicating they're logged in)
    const apikey = this.getCookie('apikey');
    this.isLoggedIn = !!apikey;
  }
  logout(): void {
    // Navigate to logout component which will handle the logout process
    this.router.navigate(['/logout']);
  }

  updateTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    this.wheatleyService.setTheme(theme);

    // Apply theme to body element
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }

  private getCookie(name: string): string {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || '';
    }
    return '';
  }
}
