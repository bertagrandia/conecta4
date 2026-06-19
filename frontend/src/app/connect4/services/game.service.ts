import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RoomInfo } from '../models';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly api = `${environment.apiUrl}/connect4`;

  constructor(private http: HttpClient) {}

  createRoom(aiMode = false): Observable<RoomInfo> {
    return this.http.post<RoomInfo>(`${this.api}/rooms/create`, { ai_mode: aiMode });
  }

  joinRoom(code: string): Observable<RoomInfo> {
    return this.http.post<RoomInfo>(`${this.api}/rooms/join/${code.toUpperCase()}`, {});
  }

  enableAI(code: string): Observable<RoomInfo> {
    return this.http.post<RoomInfo>(`${this.api}/rooms/${code.toUpperCase()}/ai`, {});
  }

  startNow(code: string): Observable<RoomInfo> {
    return this.http.post<RoomInfo>(`${this.api}/rooms/${code.toUpperCase()}/start`, {});
  }

  getRoom(code: string): Observable<RoomInfo> {
    return this.http.get<RoomInfo>(`${this.api}/rooms/${code.toUpperCase()}`);
  }
}
