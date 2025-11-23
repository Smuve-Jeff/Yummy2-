import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Mock Web Audio API
class MockAudioContext {
  state = 'suspended';
  createGain() { return { connect: () => {}, gain: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, disconnect: () => {} }; }
  createAnalyser() { return { connect: () => {}, getByteFrequencyData: () => {}, disconnect: () => {} }; }
  createMediaElementSource() { return { connect: () => {}, disconnect: () => {} }; }
  createMediaStreamSource() { return { connect: () => {} }; }
  createDynamicsCompressor() { return { connect: () => {}, threshold: { value: 0 }, ratio: { value: 0 } }; }
  createScriptProcessor() { return { connect: () => {}, onaudioprocess: () => {} }; }
  createMediaStreamDestination() { return { stream: {}, connect: () => {} }; }
  createBiquadFilter() { return { connect: () => {}, frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 }, type: '' }; }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  destination = {};
}
(window as any).AudioContext = MockAudioContext;
(window as any).webkitAudioContext = MockAudioContext;

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
