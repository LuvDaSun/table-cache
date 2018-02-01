import * as test from "blue-tape";
import { destroyIn, getIn, setIn, transform } from "./deep";

test("getIn", async t => {
    const state = {
        1: {
            2: {},
        },
    };

    t.strictEqual(getIn(state, []), state);
    t.strictEqual(getIn(state, [1]), state[1]);
    t.strictEqual(getIn(state, [1, 2]), state[1][2]);
});

test("setIn", async t => {
    const value: any = {};
    const state: any = {};

    const state1 = setIn(state, [1, 2], value);

    t.notStrictEqual(state1, state);
    t.notDeepEqual(state1, state);
    t.deepEqual(state1, {
        1: {
            2: {},
        },
    });
    t.strictEqual(state1[1][2], value);
});

test("deleteIn", async t => {
    const state = {
        1: {
            2: {},
        },
    };

    const state1 = destroyIn(state, [1, 2]);

    t.notStrictEqual(state1, state);
    t.notDeepEqual(state1, state);
    t.deepEqual(state1, { 1: {} });
});

const src = Object.freeze({
    a: "a",
    b: Object.freeze({
        c: "bc",
        d: Object.freeze({ 1: "bd1" }),
    }),
    2: 2,
});

test("transformer get", async t => {

    const dst = transform(src, ({ get }) => {
        t.equal(get(["a"]), "a");
        t.equal(get(["b", "c"]), "bc");
        t.equal(get(["b", "d", 1]), "bd1");
        t.equal(get([2]), 2);
        t.equal(get(["g", 3], 4), 4);

        t.equal(get([]), src);
        t.deepEqual(get(["b", "d"]), { 1: "bd1" });
    });
    t.equal(dst, src);

});

test("transformer set", async t => {

    {
        const dst = transform(src, ({ get, set }) => {
            set(["a"], "aa");
            t.equal(get(["a"]), "aa");
        });
        t.notEqual(dst, src);

        t.notEqual(dst.a, src.a);
        t.equal(dst.b, src.b);
        t.equal(dst[2], src[2]);

        t.equal(dst.a, "aa");
    }

    {
        const dst = transform(src, ({ get, set }) => {
            set(["b", "c"], "cb");
            t.equal(get(["b", "c"]), "cb");
        });
        t.notEqual(dst, src);

        t.equal(dst.a, src.a);
        t.notEqual(dst.b, src.b);
        t.equal(dst[2], src[2]);

        t.equal(dst.b.c, "cb");
    }

});
