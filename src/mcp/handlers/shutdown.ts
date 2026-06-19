/**
 * Shutdown Handler
 *
 * Handles cleanup of all indexers on server shutdown.
 */

import { workspaceManager } from "../workspace-manager";

/**
 * Cleanup on shutdown.
 * Delegates to WorkspaceManager singleton.
 */
export async function shutdownSTIndexer(): Promise<void> {
	await workspaceManager.shutdownAll();
}
