import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class ApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.YELLOW_BASE_URL!,
      timeout: Number(process.env.REQUEST_TIMEOUT_MS ?? 8000),
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  private async rpc<T>(method: string, params?: unknown): Promise<T> {
    const res = await this.http.post('/', { jsonrpc: '2.0', id: Date.now(), method, params });

    if (res.status >= 500) throw new HttpException('Upstream error', 502);

    if (res.data?.error) throw new HttpException(res.data.error?.message || 'Upstream error', 502);

    return res.data.result as T;
  }

  getNodeInfo() {
    return this.rpc('get_node_info');
  }
}
