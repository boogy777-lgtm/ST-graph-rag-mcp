/**
 * Zod Schemas for MCP Resources
 *
 * Schemas for validating resource URI parameters and query parameters.
 * Used by handlers to parse dynamic URI template values.
 */

import { z } from "zod";

// === Statechart Resource Schemas ===

/**
 * Schema for statechart resource URI parameters.
 * Supports optional 'view' query parameter for different output formats.
 */
export const StatechartParamsSchema = z.object({
	pouName: z.string().describe("POU name"),
	view: z
		.enum(["full", "flat", "tree", "transitions", "dot", "mermaid"])
		.optional()
		.default("full")
		.describe("view mode"),
});

export type StatechartParams = z.infer<typeof StatechartParamsSchema>;

// === Entity Resource Schemas ===

/**
 * Schema for entity resource URI parameters.
 */
export const EntityParamsSchema = z.object({
	name: z.string().describe("entity name"),
});

export type EntityParams = z.infer<typeof EntityParamsSchema>;

// === Calls Resource Schemas ===

/**
 * Schema for calls resource URI parameters.
 */
export const CallsParamsSchema = z.object({
	pouName: z.string().describe("POU name"),
});

export type CallsParams = z.infer<typeof CallsParamsSchema>;

// === Flow Resource Schemas ===

/**
 * Schema for flow resource URI parameters.
 */
export const FlowParamsSchema = z.object({
	pouName: z.string().describe("POU name"),
});

export type FlowParams = z.infer<typeof FlowParamsSchema>;

// === Interfaces Resource Schemas ===

/**
 * Schema for interfaces resource URI parameters.
 */
export const InterfacesParamsSchema = z.object({
	interfaceName: z.string().describe("interface name"),
});

export type InterfacesParams = z.infer<typeof InterfacesParamsSchema>;

// === Impact Resource Schemas ===

/**
 * Schema for impact resource URI parameters.
 */
export const ImpactParamsSchema = z.object({
	entityName: z.string().describe("entity name"),
});

export type ImpactParams = z.infer<typeof ImpactParamsSchema>;

// === Query Parameter Schema (for ?view=xxx etc.) ===

/**
 * Generic schema for parsing query string parameters from resource URIs.
 */
export const ResourceQuerySchema = z.record(z.string());

export type ResourceQuery = z.infer<typeof ResourceQuerySchema>;

// === View Type Enum ===

/**
 * Valid view types for statechart resource.
 */
export const StatechartViewEnum = z.enum([
	"full",
	"flat",
	"tree",
	"transitions",
	"dot",
	"mermaid",
]);

export type StatechartView = z.infer<typeof StatechartViewEnum>;
