import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class EnvironmentService {
    private envConfig: { [key: string]: string } = {};
    private envLoaded = false;

    constructor(private http: HttpClient) { }

    /**
     * Load the environment configuration from the .env file
     */
    loadEnvConfig(): Observable<boolean> {
        if (this.envLoaded) {
            return of(true);
        }

        return this.http.get('assets/Wheatley.env', { responseType: 'text' })
            .pipe(
                map(envFileContent => {
                    this.parseEnvFile(envFileContent);
                    this.envLoaded = true;
                    return true;
                }),
                catchError(error => {
                    console.error('Error loading environment file:', error);
                    return of(false);
                })
            );
    }

    /**
     * Parse the environment file content into key-value pairs
     */
    private parseEnvFile(content: string): void {
        const lines = content.split('\n');

        lines.forEach(line => {
            // Skip comments or empty lines
            if (line.trim().startsWith('//') || line.trim() === '') {
                return;
            }

            const keyValueMatch = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1];
                let value = keyValueMatch[2] || '';

                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.substring(1, value.length - 1);
                }

                this.envConfig[key] = value;
            }
        });
    }    /**
     * Get the value for the specified environment variable
     */
    get(key: string): string {
        return this.envConfig[key] || '';
    }    /**
     * Get the base URL for the Wheatley API (without authentication)
     */
    getWheatleyApiUrl(): string {
        const user = this.get('WHEATLEY_USER');
        return this.get('WHEATLEY_BASE_URL')?.replace(/https:\/\/[^:]+:[^@]+@/, 'https://') ||
            `https://wheatley.cs.up.ac.za/${user}/api.php`;
    }

    /**
     * Get the Wheatley API URL with authentication included (for direct access if needed)
     */
    getWheatleyApiUrlWithAuth(): string {
        const user = this.get('WHEATLEY_USER');
        const pass = this.get('WHEATLEY_PASS');
        return `https://${user}:${pass}@wheatley.cs.up.ac.za/${user}/api.php`;
    }

    /**
     * Get the Basic Auth header value for Wheatley
     */
    getWheatleyAuthHeader(): string {
        const user = this.get('WHEATLEY_USER');
        const pass = this.get('WHEATLEY_PASS');
        return 'Basic ' + btoa(`${user}:${pass}`);
    }
}
