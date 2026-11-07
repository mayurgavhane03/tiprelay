import type { Service } from '../domain/service';
export interface Request {
  method: string;
  path: string;
  body?: unknown;
  token?: string;
  creatorId?: string;
  ip: string;
  correlationId?: string;
  cursor?: string;
}
export interface RouteDefinition {
  matches(request: Request): boolean;
  handle(service: Service, request: Request): Promise<unknown>;
}
export interface RouteGroup {
  matches(request: Request): boolean;
  before?(service: Service, request: Request): Promise<void>;
  routes: RouteDefinition[];
}
