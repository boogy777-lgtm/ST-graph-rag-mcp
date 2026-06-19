import { createHash } from "crypto";
import { readFileSync } from "fs";
import { relative } from "path";
import { pathToFileURL } from "url";
import { extractComments, stripComments } from "../comment-stripper";

export interface PrepareResult {
	filePath: string;
	relativePath: string;
	uri: string;
	originalContent: string;
	strippedContent: string;
	hash: string;
	comments: string[];
}

export function prepareStage(
	filePath: string,
	workspaceDir: string,
): PrepareResult {
	const relativePath = relative(workspaceDir, filePath);
	const originalContent = readFileSync(filePath, "utf8");
	const hash = createHash("sha256").update(originalContent).digest("hex");
	const comments = extractComments(originalContent);
	const strippedContent = stripComments(originalContent);
	const uri = pathToFileURL(filePath).href;

	return {
		filePath,
		relativePath,
		uri,
		originalContent,
		strippedContent,
		hash,
		comments,
	};
}
