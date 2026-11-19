// Messages between the page and ai.worker.ts.

import type { AiErrorCode, ChatRequest, TestResult } from './client';
import type { AiSettings, AiStatus } from './engine';

export type AiIn =
  | { op: 'status'; id: number }
  | { op: 'configure'; id: number; settings: AiSettings; key?: string }
  | { op: 'forget'; id: number }
  | { op: 'lock'; id: number; on: boolean }
  | { op: 'test'; id: number }
  | { op: 'models'; id: number }
  | { op: 'chat'; id: number; req: ChatRequest }
  | { op: 'abort'; id: number; target: number };

export type AiOut =
  | { op: 'status'; id: number; status: AiStatus }
  | { op: 'test'; id: number; result: TestResult }
  | { op: 'models'; id: number; models: string[] }
  | { op: 'delta'; id: number; text: string }
  | { op: 'done'; id: number; text: string }
  | { op: 'error'; id: number; code: AiErrorCode; detail?: string; status?: number };
