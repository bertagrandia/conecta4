import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SnakeRoomSummary } from '../models';

@Injectable({ providedIn: 'root' })
export class SnakeRoomService {
  private readonly api = `${environment.apiUrl}/snake`;

  constructor(private http: HttpClient) {}

  listPublicRooms(): Observable<SnakeRoomSummary[]> {
    return this.http.get<SnakeRoomSummary[]>(`${this.api}/rooms`);
  }

  createPrivateRoom(): Observable<SnakeRoomSummary> {
    return this.http.post<SnakeRoomSummary>(`${this.api}/rooms/create`, {});
  }

  getRoom(roomId: string): Observable<SnakeRoomSummary> {
    return this.http.get<SnakeRoomSummary>(`${this.api}/rooms/${roomId.toUpperCase()}`);
  }
}
