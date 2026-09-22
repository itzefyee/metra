/**
 * Browser client for Metra's Convex CAD HTTP endpoints.
 *
 * Anonymous generations use a random per-generation capability. It is stored
 * only in this browser's local history and is required for later status,
 * download, and deletion requests.
 */

import {
  CADGenerationRequest,
  CADGenerationResult,
  CADGenerationStatus,
  CADHistoryItem,
} from '@/types/cad.types';

const HISTORY_STORAGE_KEY = 'metra-cad-generation-history';
const MAX_LOCAL_HISTORY = 50;

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
}

export class CADAPI {
  private static readonly BASE_URL = '/api/cad';

  private static readHistory(): CADHistoryItem[] {
    if (typeof window === 'undefined') return [];

    try {
      const value: unknown = JSON.parse(
        window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]',
      );
      if (!Array.isArray(value)) return [];
      return value.filter(
        (item): item is CADHistoryItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CADHistoryItem)._id === 'string' &&
          typeof (item as CADHistoryItem).accessToken === 'string',
      );
    } catch {
      return [];
    }
  }

  private static writeHistory(history: CADHistoryItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Browser storage can be unavailable in private contexts. The active
      // page still has the returned capability until it is refreshed.
    }
  }

  private static accessTokenFor(generationId: string): string {
    const item = this.readHistory().find((entry) => entry._id === generationId);
    if (!item?.accessToken) {
      throw new Error('This generation is not available on this device.');
    }
    return item.accessToken;
  }

  static rememberGeneration(
    result: CADGenerationResult,
    request: CADGenerationRequest,
  ): void {
    const createdAt = Date.parse(result.parameters.generated_at) || Date.now();
    const item: CADHistoryItem = {
      _id: result.id,
      description: request.description,
      category: result.parameters.category,
      format: result.parameters.format,
      units: result.parameters.units,
      stepFileId: result.stepFileId,
      accessToken: result.accessToken,
      status: result.status,
      createdAt,
    };
    const history = this.readHistory().filter((entry) => entry._id !== item._id);
    this.writeHistory([item, ...history].slice(0, MAX_LOCAL_HISTORY));
  }

  static async generate(
    request: CADGenerationRequest,
    userId?: string,
  ): Promise<CADGenerationResult> {
    const response = await fetch(`${this.BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, userId }),
    });
    if (!response.ok) {
      throw new Error(await errorMessage(response, 'Generation failed'));
    }
    return response.json();
  }

  static async getStatus(generationId: string): Promise<CADGenerationStatus> {
    const search = new URLSearchParams({
      accessToken: this.accessTokenFor(generationId),
    });
    const response = await fetch(
      `${this.BASE_URL}/status/${encodeURIComponent(generationId)}?${search}`,
    );
    if (!response.ok) {
      throw new Error(await errorMessage(response, 'Failed to get status'));
    }
    return response.json();
  }

  static async getHistory(limit = 20): Promise<CADHistoryItem[]> {
    return this.readHistory().slice(0, Math.max(1, Math.min(limit, MAX_LOCAL_HISTORY)));
  }

  static async deleteGeneration(generationId: string): Promise<void> {
    const search = new URLSearchParams({
      accessToken: this.accessTokenFor(generationId),
    });
    const response = await fetch(
      `${this.BASE_URL}/generation/${encodeURIComponent(generationId)}?${search}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw new Error(await errorMessage(response, 'Failed to delete generation'));
    }
    this.writeHistory(
      this.readHistory().filter((entry) => entry._id !== generationId),
    );
  }

  static async downloadFile(
    generationId: string,
    format = 'step',
  ): Promise<Blob> {
    const search = new URLSearchParams({
      format,
      accessToken: this.accessTokenFor(generationId),
    });
    const response = await fetch(
      `${this.BASE_URL}/download/${encodeURIComponent(generationId)}?${search}`,
    );
    if (!response.ok) {
      throw new Error(await errorMessage(response, 'Failed to download'));
    }
    return response.blob();
  }

  static triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }
}
