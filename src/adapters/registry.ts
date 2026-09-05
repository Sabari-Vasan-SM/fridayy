/**
 * Fridayy - Adapter Registry
 * Central repository for pluggable application adapters.
 */

import { BaseAdapter } from './base.js';
import { OpenApiAdapter } from './openapi/adapter.js';
import { RestAdapter } from './rest/adapter.js';
import { NodeJsAdapter } from './nodejs/adapter.js';
import { LaravelAdapter } from './laravel/adapter.js';
import { ManualAdapter } from './manual/adapter.js';

export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new OpenApiAdapter());
    this.register(new RestAdapter());
    this.register(new NodeJsAdapter());
    this.register(new LaravelAdapter());
    this.register(new ManualAdapter());
  }

  /**
   * Registers a new adapter instance.
   */
  public register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  /**
   * Retrieves an adapter by name.
   */
  public get(name: string): BaseAdapter | undefined {
    return this.adapters.get(name.toLowerCase());
  }

  /**
   * Returns all registered adapters.
   */
  public getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Checks if an adapter is registered.
   */
  public has(name: string): boolean {
    return this.adapters.has(name.toLowerCase());
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
