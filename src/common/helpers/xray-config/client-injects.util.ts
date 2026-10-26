type TRecord = Record<string, unknown>;

function isRecord(value: unknown): value is TRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Applies the `clientInjects` block of a config profile to vless inbound clients.
 *
 * The block is a top-level key of the profile JSON:
 *   "clientInjects": {
 *     "<field name>": { "rules": { "<selector value>": <value> }, "selectorField": "<field>" }
 *   }
 *
 * For every client object in `settings.clients` of every vless inbound whose `selectorField`
 * value (stringified) equals a rule key, the injected value is assigned to the field:
 * overwrites if present, creates if not. Structs/arrays are assigned as-is, no merging,
 * no field-name validation — the code is intentionally dumb so it keeps working for
 * fields that Xray may add in the future.
 *
 * The `clientInjects` key is always removed from the config, so it never reaches Xray cores.
 * Malformed blocks are ignored (no-op), as are rules that match nothing.
 */
export function applyClientInjects(config: TRecord): void {
    const injects = config.clientInjects;
    delete config.clientInjects;

    if (!isRecord(injects) || !Array.isArray(config.inbounds)) {
        return;
    }

    for (const inbound of config.inbounds) {
        if (!isRecord(inbound) || inbound.protocol !== 'vless') {
            continue;
        }

        const settings = isRecord(inbound.settings) ? inbound.settings : undefined;
        const clients = settings && Array.isArray(settings.clients) ? settings.clients : [];

        for (const [field, group] of Object.entries(injects)) {
            if (!isRecord(group) || !isRecord(group.rules)) {
                continue;
            }

            const selectorField =
                typeof group.selectorField === 'string' ? group.selectorField : 'email';

            for (const [selectorValue, injected] of Object.entries(group.rules)) {
                for (const client of clients) {
                    if (!isRecord(client)) {
                        continue;
                    }

                    const selector = client[selectorField];
                    if (
                        selector !== undefined &&
                        selector !== null &&
                        String(selector) === selectorValue
                    ) {
                        client[field] = injected;
                    }
                }
            }
        }
    }
}
