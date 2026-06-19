/**
 * MCP Resources Module
 *
 * Barrel export for the resources module.
 * Provides resource registration, handlers, types, and schemas.
 *
 * @module resources
 */

// Handlers
export { handleResourceRead, parseResourceURI } from "./handlers.js";
// Registry
export {
	getResourceCount,
	getResourceDefinitions,
	registerResources,
} from "./registry.js";
export type {
	CallsParams,
	EntityParams,
	FlowParams,
	ImpactParams,
	InterfacesParams,
	ResourceQuery,
	StatechartParams,
	StatechartView,
} from "./schemas.js";

// Schemas
export {
	CallsParamsSchema,
	EntityParamsSchema,
	FlowParamsSchema,
	ImpactParamsSchema,
	InterfacesParamsSchema,
	ResourceQuerySchema,
	StatechartParamsSchema,
	StatechartViewEnum,
} from "./schemas.js";
// Types
export type {
	CallEntry,
	CallsData,
	EntityData,
	EntityVariable,
	FileEntry,
	FilesListData,
	GlobalsData,
	GlobalVariable,
	ResourceDefinition,
	ResourceError,
	ResourceTemplateDefinition,
	StatechartBaseData,
	StatechartData,
	StatechartDiagramData,
	StatechartFlatData,
	StatechartFullData,
	StatechartMetrics,
	StatechartTransitionsData,
	StatechartTreeData,
	StateNode,
	StateTransition,
	StateTreeNode,
} from "./types.js";
