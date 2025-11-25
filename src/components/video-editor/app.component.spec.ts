import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppComponent } from './app.component';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy } from '@angular/core';

describe('AppComponent', () => {
  let component: AppComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
    }).overrideComponent(AppComponent, {
      set: {
        changeDetection: ChangeDetectionStrategy.Default,
      },
    });

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
