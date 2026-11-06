export const PLAN_RPC_ID = "opencode.plan-sidebar";
function schema(check) {
    return {
        "~standard": {
            version: 1,
            vendor: "opencode-plan-sidebar",
            validate: (value) => {
                const issue = check(value);
                return issue ? { issues: [{ message: issue }] } : { value: value };
            },
        },
    };
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export const PlanRpc = {
    id: PLAN_RPC_ID,
    events: {
        updated: {
            schema: schema((value) => {
                if (!isObject(value))
                    return "event data must be an object";
                if (typeof value.sessionID !== "string")
                    return "sessionID must be a string";
                return null;
            }),
        },
    },
    methods: {
        get: {
            input: schema((value) => {
                if (!isObject(value))
                    return "input must be an object";
                if (typeof value.sessionID !== "string" || !value.sessionID) {
                    return "sessionID must be a non-empty string";
                }
                return null;
            }),
            output: schema((value) => {
                if (!isObject(value))
                    return "output must be an object";
                return null;
            }),
        },
        discover: {
            input: schema((value) => {
                if (!isObject(value))
                    return "input must be an object";
                if (value.directory !== undefined && typeof value.directory !== "string") {
                    return "directory must be a string";
                }
                return null;
            }),
            output: schema((value) => {
                if (!isObject(value))
                    return "output must be an object";
                return null;
            }),
        },
        select: {
            input: schema((value) => {
                if (!isObject(value))
                    return "input must be an object";
                if (typeof value.sessionID !== "string" || !value.sessionID) {
                    return "sessionID must be a non-empty string";
                }
                if (typeof value.filePath !== "string" || !value.filePath) {
                    return "filePath must be a non-empty string";
                }
                return null;
            }),
            output: schema((value) => {
                if (!isObject(value))
                    return "output must be an object";
                return null;
            }),
        },
        clear: {
            input: schema((value) => {
                if (!isObject(value))
                    return "input must be an object";
                if (typeof value.sessionID !== "string" || !value.sessionID) {
                    return "sessionID must be a non-empty string";
                }
                return null;
            }),
            output: schema((value) => {
                if (!isObject(value))
                    return "output must be an object";
                return null;
            }),
        },
    },
};
