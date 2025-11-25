import { Injectable } from '@angular/core';
import { AppState } from './music-data.service';

@Injectable({
  providedIn: 'root'
})
export class CloudStorageService {
  private readonly STORAGE_KEY = 'smuve_project';

  saveProject(state: AppState): void {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(this.STORAGE_KEY, serializedState);
    } catch (error) {
      console.error('Error saving project to cloud storage:', error);
    }
  }

  loadProject(): AppState | null {
    try {
      const serializedState = localStorage.getItem(this.STORAGE_KEY);
      if (serializedState === null) {
        return null;
      }
      return JSON.parse(serializedState);
    } catch (error) {
      console.error('Error loading project from cloud storage:', error);
      return null;
    }
  }
}
