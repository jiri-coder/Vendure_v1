/**
 * The Vendure dashboard keeps relation objects on `customFields.{name}` and also writes
 * `customFields.{name}Ids`. GraphQL update inputs only accept the Ids field, so the
 * leftover object key is rejected. Strip it before variable validation.
 */
export function sanitizeCustomFieldRelationInputs(variables: unknown): void {
    if (!variables || typeof variables !== 'object') {
        return;
    }

    const input = (variables as { input?: unknown }).input;
    if (!input || typeof input !== 'object') {
        return;
    }

    const customFields = (input as { customFields?: unknown }).customFields;
    if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) {
        return;
    }

    const fields = customFields as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
        if (key.endsWith('Ids') || key.endsWith('Id')) {
            continue;
        }
        if (`${key}Ids` in fields || `${key}Id` in fields) {
            delete fields[key];
        }
    }
}
