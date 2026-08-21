import assert from "assert";

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Import dynamic due to ES Modules in api.js
    const api = await import("../frontend/lib/api.js");
    const { parseSearchQuery, chatWithAssistant } = api;

    // Polyfill fetch
    const originalFetch = global.fetch;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`FAIL: ${name}`);
            console.error(err);
            failed++;
        }
    }

    await test("test_parseSearchQuery_sends_correct_body", async () => {
        let fetchArgs = {};
        global.fetch = async (url, options) => {
            fetchArgs = { url, options };
            return { ok: true, text: async () => JSON.stringify({ area: "Baner" }) };
        };

        const res = await parseSearchQuery("1bhk in Baner", "test-token");

        assert(fetchArgs.url.includes("/listings/parse-search"), "Incorrect URL");
        assert.strictEqual(fetchArgs.options.method, "POST");
        assert.strictEqual(JSON.parse(fetchArgs.options.body).query, "1bhk in Baner");
        assert.strictEqual(fetchArgs.options.headers["Authorization"], "Bearer test-token");
        assert.deepStrictEqual(res, { area: "Baner" });
    });

    await test("test_parseSearchQuery_returns_empty_on_fetch_error", async () => {
        global.fetch = async () => {
            throw new Error("network down");
        };

        const res = await parseSearchQuery("anything", "token");
        assert.deepStrictEqual(res, {});
    });

    await test("test_chatWithAssistant_sends_correct_body", async () => {
        let fetchArgs = {};
        global.fetch = async (url, options) => {
            fetchArgs = { url, options };
            return { ok: true, text: async () => JSON.stringify({ reply: "Safe area." }) };
        };

        const res = await chatWithAssistant(
            "listing-uuid-123",
            [{ role: "user", content: "Is it safe?" }],
            { area: "Baner", city: "Pune" },
            "test-token"
        );

        assert(fetchArgs.url.includes("/listings/listing-uuid-123/chat"), "Incorrect URL");
        assert.strictEqual(fetchArgs.options.method, "POST");

        const body = JSON.parse(fetchArgs.options.body);
        assert.strictEqual(body.messages[0].content, "Is it safe?");
        assert.strictEqual(body.listing_context.area, "Baner");
        assert.strictEqual(fetchArgs.options.headers["Authorization"], "Bearer test-token");
        assert.deepStrictEqual(res, { reply: "Safe area." });
    });

    await test("test_chatWithAssistant_throws_on_non_2xx", async () => {
        global.fetch = async () => {
            return { ok: false, status: 502, statusText: "Bad Gateway", text: async () => null };
        };

        let rejected = false;
        try {
            await chatWithAssistant("id", [], {}, "token");
        } catch (e) {
            rejected = true;
        }
        assert(rejected, "Promise did not reject");
    });

    // Restore fetch
    global.fetch = originalFetch;

    console.log(`\nFrontend tests: ${passed} passed / ${failed} failed`);
    if (failed === 0) {
        console.log("All frontend helper tests passed.");
    }
}

runTests();
