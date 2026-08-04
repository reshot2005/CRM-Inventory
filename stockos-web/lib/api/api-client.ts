import { createClient } from '../supabase/client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

interface ApiErrorBody {
  success?: boolean;
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  private async handleError(response: Response): Promise<never> {
    const data = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message =
      data.error?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data.error?.code);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      headers: await this.getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      await this.handleError(response);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }

  /** For endpoints that return `{ data, meta }` at the top level (pagination). */
  async getWithMeta<T, M extends object = object>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ data: T; meta: M }> {
    const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: await this.getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      await this.handleError(response);
    }
    const json = (await response.json()) as { data: T; meta: M };
    return { data: json.data, meta: json.meta };
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(
      `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    );

    if (!response.ok) {
      await this.handleError(response);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(
      `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`,
      {
        method: 'PATCH',
        headers: await this.getHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    );

    if (!response.ok) {
      await this.handleError(response);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(
      `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`,
      {
        method: 'DELETE',
        headers: await this.getHeaders(),
      },
    );

    if (!response.ok) {
      await this.handleError(response);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }
}

export const api = new ApiClient();
