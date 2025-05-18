import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import * as L from 'leaflet';

export interface DustDevil {
    id: string;
    position: L.LatLng;
    createdAt: number;
}

export interface DronePosition {
    lat: number;
    lng: number;
    altitude: number;
    batteryLife: number;
    timestamp: number;
}

interface DroneState {
    position: DronePosition;
    history: DronePosition[];
}

@Injectable({
    providedIn: 'root'
})
export class DustDevilService {
    private dustDevils = new BehaviorSubject<DustDevil[]>([]);
    private droneState = new BehaviorSubject<DroneState>({
        position: {
            lat: -25.7487,
            lng: 28.2380,
            altitude: 20,
            batteryLife: 600,
            timestamp: Date.now()
        },
        history: []
    });
    private warningSubject = new BehaviorSubject<string | null>(null);

    // Constants
    private readonly CENTER_LAT = -25.7487;
    private readonly CENTER_LNG = 28.2380;
    private readonly RADIUS = 0.01;
    private readonly HQ_LAT = -25.7487;
    private readonly HQ_LNG = 28.2380;
    private readonly MAX_RANGE = 5000;
    private readonly MAX_ALTITUDE = 30;
    private readonly MIN_ALTITUDE = 20;
    private readonly HISTORY_SIZE = 10;

    constructor() {
        // Start generating dust devils every minute
        interval(60000).subscribe(() => {
            this.generateDustDevils();
        });

        // Initial generation
        this.generateDustDevils();
    }

    getDustDevils(): Observable<DustDevil[]> {
        return this.dustDevils.asObservable();
    }

    getWarnings(): Observable<string | null> {
        return this.warningSubject.asObservable();
    }

    getDroneState(): Observable<DroneState> {
        return this.droneState.asObservable();
    }

    setDronePosition(newPosition: Partial<DronePosition>) {
        const currentState = this.droneState.value;
        const currentPos = currentState.position;

        // Create new position with defaults from current position
        const updatedPosition: DronePosition = {
            ...currentPos,
            ...newPosition,
            timestamp: Date.now()
        };

        // Round coordinates
        [updatedPosition.lat, updatedPosition.lng] = this.roundCoords(updatedPosition.lat, updatedPosition.lng);

        // Check if new position is within range
        if (!this.isInRange(updatedPosition.lat, updatedPosition.lng)) {
            this.warningSubject.next(`WARNING: Drone cannot move beyond 5km from HQ!`);
            return;
        }

        // Check altitude limits
        if (updatedPosition.altitude > this.MAX_ALTITUDE) {
            updatedPosition.altitude = this.MAX_ALTITUDE;
            this.warningSubject.next(`WARNING: Maximum altitude reached!`);
        } else if (updatedPosition.altitude < this.MIN_ALTITUDE) {
            updatedPosition.altitude = this.MIN_ALTITUDE;
            this.warningSubject.next(`WARNING: Minimum altitude reached!`);
        }

        // Update history before position
        const newHistory = [currentPos, ...currentState.history].slice(0, this.HISTORY_SIZE);

        this.droneState.next({
            position: updatedPosition,
            history: newHistory
        });

        // Check for collisions after position update
        this.checkDroneCollisions();
    }

    revertToLastPosition() {
        const currentState = this.droneState.value;
        if (currentState.history.length > 0) {
            const lastPosition = currentState.history[0];
            // Increase altitude by 5m when reverting due to collision
            lastPosition.altitude = Math.min(lastPosition.altitude + 5, this.MAX_ALTITUDE);

            this.droneState.next({
                position: lastPosition,
                history: currentState.history.slice(1)
            });
        }
    }

    private generateDustDevils() {
        // Remove expired dust devils (older than 1 minute)
        const now = Date.now();
        const currentDevils = this.dustDevils.value.filter(
            devil => (now - devil.createdAt) <= 60000
        );

        // Generate 5-10 new dust devils
        const count = Math.floor(Math.random() * 6) + 5;
        const newDevils = Array(count).fill(0).map(() => this.createDustDevil());

        // Combine active and new dust devils
        this.dustDevils.next([...currentDevils, ...newDevils]);

        // Check for collisions with drone
        this.checkDroneCollisions();
    }

    private createDustDevil(): DustDevil {
        let lat: number, lng: number;
        do {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * this.RADIUS;

            // Calculate position within radius of Hatfield
            lat = this.HQ_LAT + (distance * Math.cos(angle));
            lng = this.HQ_LNG + (distance * Math.sin(angle));

            // Round to 4 decimal places
            [lat, lng] = this.roundCoords(lat, lng);
        } while (!this.isInRange(lat, lng)); // Ensure within 5km of HQ

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            position: L.latLng(lat, lng),
            createdAt: Date.now()
        };
    }

    private checkDroneCollisions() {
        const currentState = this.droneState.value;
        const dronePos = currentState.position;

        for (const devil of this.dustDevils.value) {
            const distance = this.calculateDistance(
                dronePos.lat,
                dronePos.lng,
                devil.position.lat,
                devil.position.lng
            );

            if (distance < 0.0001) { // About 11 meters
                this.warningSubject.next(`WARNING: Dust devil collision detected!`);
                this.revertToLastPosition();
                return;
            }
        }
    }

    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    private isInRange(lat: number, lng: number): boolean {
        return this.calculateDistance(this.HQ_LAT, this.HQ_LNG, lat, lng) <= this.MAX_RANGE;
    }

    // Round coordinates to 4 decimal places
    private roundCoords(lat: number, lng: number): [number, number] {
        return [
            Number(lat.toFixed(4)),
            Number(lng.toFixed(4))
        ];
    }
}
