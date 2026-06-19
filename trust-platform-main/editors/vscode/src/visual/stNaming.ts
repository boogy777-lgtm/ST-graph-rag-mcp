export function sanitizeIdentifier(
	raw: string,
	fallback = "Generated",
): string {
	const trimmed = raw.trim();
	const normalized = trimmed
		.replace(/[^A-Za-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+/, "")
		.replace(/_+$/, "");

	if (!normalized) {
		return fallback;
	}

	if (/^[0-9]/.test(normalized)) {
		return `_${normalized}`;
	}

	return normalized;
}

export function fbNameForSource(baseName: string, suffix: string): string {
	const id = sanitizeIdentifier(baseName, "Generated");
	return sanitizeIdentifier(`FB_${id}_${suffix}`, "FB_Generated");
}

export function stateConstantName(stateName: string): string {
	return sanitizeIdentifier(
		`STATE_${stateName}`.toUpperCase(),
		"STATE_FALLBACK",
	);
}

export function eventInputName(eventName: string): string {
	return sanitizeIdentifier(`EV_${eventName}`.toUpperCase(), "EV_TRIGGER");
}

export function localName(prefix: string, source: string): string {
	return sanitizeIdentifier(`${prefix}_${source}`, `${prefix}_generated`);
}

export function escapeStString(value: string): string {
	return value.replace(/'/g, "''");
}

export function isDirectAddress(value: string): boolean {
	return /^%[IQM][XWDLB]\d+(?:\.\d+)?$/i.test(value.trim());
}

export function isAssignableIdentifier(value: string): boolean {
	const candidate = value.trim();
	if (!candidate) {
		return false;
	}
	if (isDirectAddress(candidate)) {
		return true;
	}
	return /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(candidate);
}
