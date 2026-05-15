import { DataOfResponse, createUri } from '@vvedo/openapi-ts';
import request, { ReqOpts } from './request';
/**
 * User role
 */
export type UserRole = "admin" | "member";
export type User = {
    /** User id */
    id: string;
    /** User name */
    name: string;
    role: UserRole;
};
export type UserListResponse = {
    data: User[];
};
export type CreateUserRequest = {
    name: string;
    role: UserRole;
};
export type UserResponse = {
    data: User;
};
/**
 * Enum collection
 */
export const enums = {};
/**
 * List users /api/users
 */
export function listUsers(params: {
    page?: number;
}, opts?: ReqOpts) {
    const { ...query } = params;
    return request<DataOfResponse<UserListResponse>>(createUri("/api/users", query), { ...opts });
}
/**
 * Create user /api/users
 */
export function createUser(data: CreateUserRequest, opts?: ReqOpts) {
    return request<DataOfResponse<UserResponse>>("/api/users", { method: "POST", data, ...opts });
}
/**
 * Get user /api/users/{id}
 */
export function getUser(params: {
    id: string;
}, opts?: ReqOpts) {
    const { id } = params;
    return request<DataOfResponse<UserResponse>>(`/api/users/${id}`, { ...opts });
}
